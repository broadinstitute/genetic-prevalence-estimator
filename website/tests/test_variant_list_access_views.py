# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from calculator.models import VariantList, VariantListAccessPermission


User = get_user_model()


@pytest.mark.django_db
class TestCreateVariantListAccessPermission:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        owner = User.objects.create(username="owner")
        viewer = User.objects.create(username="viewer")
        User.objects.create(username="other")

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=owner,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=viewer,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    def test_granting_variants_list_access_requires_authentication(self):
        client = APIClient()
        response = client.post(
            "/api/variant-list-access/",
            {
                "user": "other",
                "variant_list": 1,
                "level": "Viewer",
            },
        )
        assert response.status_code == 403

    def test_granting_variants_list_access_requires_permission(self):
        # Only variant list owners should be able to grant access to the list.
        client = APIClient()

        client.force_authenticate(User.objects.get(username="viewer"))
        response = client.post(
            "/api/variant-list-access/",
            {
                "user": "other",
                "variant_list": 1,
                "level": "Viewer",
            },
        )
        assert response.status_code == 403

        client.force_authenticate(User.objects.get(username="owner"))
        response = client.post(
            "/api/variant-list-access/",
            {
                "user": "other",
                "variant_list": 2,
                "level": "Viewer",
            },
        )
        assert response.status_code == 403

        assert (
            VariantListAccessPermission.objects.filter(
                user__username="other", variant_list=1
            ).count()
            == 0
        )

        response = client.post(
            "/api/variant-list-access/",
            {
                "user": "other",
                "variant_list": 1,
                "level": "Viewer",
            },
        )
        assert response.status_code == 200

        assert (
            VariantListAccessPermission.objects.filter(
                user__username="other",
                variant_list=1,
                level=VariantListAccessPermission.Level.VIEWER,
            ).count()
            == 1
        )

    def test_granting_variants_list_access_stores_user(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(
            "/api/variant-list-access/",
            {
                "user": "other",
                "variant_list": 1,
                "level": "Viewer",
            },
        )
        access = VariantListAccessPermission.objects.get(
            user__username="other",
            variant_list=1,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        assert access.created_by.username == "owner"


@pytest.mark.django_db
class TestGetVariantListAccessPermission:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        owner = User.objects.create(username="owner")
        editor = User.objects.create(username="editor")
        viewer = User.objects.create(username="viewer")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            id=1,
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            id=2,
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            id=3,
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    def test_viewing_variant_list_access_requires_authentication(self):
        access = VariantListAccessPermission.objects.get(id=1)
        client = APIClient()
        response = client.get(f"/api/variant-list-access/{access.uuid}/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,access_id,expected_response",
        [
            ("owner", 1, 200),
            ("owner", 2, 200),
            ("owner", 3, 200),
            ("editor", 1, 404),
            ("editor", 2, 200),
            ("editor", 3, 404),
            ("viewer", 1, 404),
            ("viewer", 2, 404),
            ("viewer", 3, 200),
            ("other", 1, 404),
            ("other", 2, 404),
            ("other", 3, 404),
        ],
    )
    def test_viewing_variant_list_access_requires_permission(
        self, username, access_id, expected_response
    ):
        # Variant list owners should be able to see all access for the variant list.
        # Other users should be able to see their own access.
        access = VariantListAccessPermission.objects.get(id=access_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get(f"/api/variant-list-access/{access.uuid}/")
        assert response.status_code == expected_response

    @pytest.mark.parametrize(
        "username,access_id,expected_level",
        [
            ("owner", 1, "Owner"),
            ("owner", 3, "Viewer"),
            ("editor", 2, "Editor"),
            ("viewer", 3, "Viewer"),
        ],
    )
    def test_viewing_variant_list_includes_access_level(
        self, username, access_id, expected_level
    ):
        access = VariantListAccessPermission.objects.get(id=access_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get(f"/api/variant-list-access/{access.uuid}/")
        assert response.status_code == 200

        access = response.json()["variant_list_access"]
        assert "level" in access
        assert access["level"] == expected_level


@pytest.mark.django_db
class TestEditVariantListAccessPermission:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        owner = User.objects.create(username="owner")
        editor = User.objects.create(username="editor")
        viewer = User.objects.create(username="viewer")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            id=1,
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            id=2,
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            id=3,
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    def test_editing_variant_list_access_requires_authentication(self):
        access = VariantListAccessPermission.objects.get(id=1)
        client = APIClient()
        response = client.patch(
            f"/api/variant-list-access/{access.uuid}/",
            {"level": VariantListAccessPermission.Level.VIEWER},
        )
        assert response.status_code == 403
        access.refresh_from_db()
        assert access.level == VariantListAccessPermission.Level.OWNER

    def test_editing_variant_list_access_requires_permission(self):
        # Only variant list owners should be able to edit access level.
        access = VariantListAccessPermission.objects.get(id=3)

        client = APIClient()

        for username, expected_status_code in [
            ("other", 404),
            ("viewer", 403),
            ("editor", 404),
        ]:
            client.force_authenticate(User.objects.get(username=username))
            response = client.patch(
                f"/api/variant-list-access/{access.uuid}/",
                {"level": VariantListAccessPermission.Level.EDITOR},
            )
            assert response.status_code == expected_status_code
            access.refresh_from_db()
            assert access.level == VariantListAccessPermission.Level.VIEWER

        client.force_authenticate(User.objects.get(username="owner"))
        response = client.patch(
            f"/api/variant-list-access/{access.uuid}/",
            {"level": VariantListAccessPermission.Level.EDITOR},
        )
        assert response.status_code == 200
        access.refresh_from_db()
        assert access.level == VariantListAccessPermission.Level.EDITOR

    def test_user_cannot_edit_their_own_access(self):
        access = VariantListAccessPermission.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        response = client.patch(
            f"/api/variant-list-access/{access.uuid}/",
            {"level": VariantListAccessPermission.Level.VIEWER},
        )
        assert response.status_code == 403
        access.refresh_from_db()
        assert access.level == VariantListAccessPermission.Level.OWNER

    def test_editing_variant_list_stores_user(self):
        access = VariantListAccessPermission.objects.get(id=2)
        assert not access.last_updated_by
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.patch(
            f"/api/variant-list-access/{access.uuid}/",
            {"level": VariantListAccessPermission.Level.VIEWER},
        )
        access.refresh_from_db()
        assert access.last_updated_by.username == "owner"


class TestDeleteVariantListAccessPermission:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True, scope="function")
    def db_setup(self):
        owner = User.objects.create(username="owner")
        editor = User.objects.create(username="editor")
        viewer = User.objects.create(username="viewer")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            id=1,
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            id=2,
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            id=3,
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    @pytest.mark.django_db
    def test_deleting_variant_list_access_requires_authentication(self):
        acccess = VariantListAccessPermission.objects.get(id=1)
        client = APIClient()
        response = client.delete(
            f"/api/variant-list-access/{acccess.uuid}/",
        )
        assert response.status_code == 403
        assert VariantListAccessPermission.objects.count() == 3

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "username,expected_response",
        [("owner", 204), ("editor", 404), ("viewer", 403), ("other", 404)],
    )
    def test_deleting_variant_list_access_requires_permission(
        self, username, expected_response
    ):
        access = VariantListAccessPermission.objects.get(id=3)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.delete(f"/api/variant-list-access/{access.uuid}/")
        assert response.status_code == expected_response
        if expected_response == 204:
            assert VariantListAccessPermission.objects.count() == 2
        else:
            assert VariantListAccessPermission.objects.count() == 3

    @pytest.mark.django_db
    def test_user_cannot_delete_their_own_access(self):
        access = VariantListAccessPermission.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        response = client.patch(
            f"/api/variant-list-access/{access.uuid}/",
            {"level": VariantListAccessPermission.Level.VIEWER},
        )
        assert response.status_code == 403
        access.refresh_from_db()
        assert access.level == VariantListAccessPermission.Level.OWNER
