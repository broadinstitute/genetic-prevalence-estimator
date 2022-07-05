# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from calculator.models import VariantList, VariantListAccessPermission


User = get_user_model()


@pytest.mark.django_db
class TestGetVariantLists:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        user1 = User.objects.create(username="User 1")
        user2 = User.objects.create(username="User 2")

        list1 = VariantList.objects.create(
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(variant_list=list1, user=user1)
        VariantListAccessPermission.objects.create(variant_list=list1, user=user2)

        list2 = VariantList.objects.create(
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(variant_list=list2, user=user1)

    def test_variants_list_requires_authentication(self):
        client = APIClient()
        response = client.get("/api/variant-lists/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,expected_lists",
        [("User 1", {"List 1", "List 2"}), ("User 2", {"List 1"})],
    )
    def test_listing_variants_list_requires_permission(self, username, expected_lists):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        variant_lists = client.get("/api/variant-lists/").json()

        assert len(variant_lists) == len(expected_lists)
        assert (
            set(variant_list["label"] for variant_list in variant_lists)
            == expected_lists
        )


class TestCreateVariantList:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="testuser")

    @pytest.mark.django_db
    def test_creating_variant_list_requires_authentication(self):
        client = APIClient()
        response = client.post(
            "/api/variant-lists/",
            {
                "label": "A variant list",
                "type": VariantList.Type.CUSTOM,
                "metadata": {
                    "gnomad_version": "2.1.1",
                },
                "variants": [{"id": "1-55516888-G-GA"}],
            },
        )
        assert response.status_code == 403
        assert VariantList.objects.count() == 0

    @pytest.mark.django_db
    def test_user_is_assigned_ownership_of_new_list(self):
        client = APIClient()
        testuser = User.objects.get(username="testuser")
        client.force_authenticate(testuser)
        response = client.post(
            "/api/variant-lists/",
            {
                "label": "A variant list",
                "type": VariantList.Type.CUSTOM,
                "metadata": {
                    "gnomad_version": "2.1.1",
                },
                "variants": [{"id": "1-55516888-G-GA"}],
            },
        )

        assert response.status_code == 201
        assert VariantList.objects.count() == 1

        assert response.has_header("Location")

        response = client.get(response.headers["Location"]).json()
        variant_list = VariantList.objects.get(uuid=response["uuid"])

        access = VariantListAccessPermission.objects.get(
            variant_list=variant_list, user=testuser
        )
        assert access
        assert access.level == VariantListAccessPermission.Level.OWNER

    @pytest.mark.django_db
    @override_settings(MAX_VARIANT_LISTS_PER_USER=5)
    def test_user_is_allowed_a_limited_number_of_variant_lists(self):
        client = APIClient()
        testuser = User.objects.get(username="testuser")
        client.force_authenticate(testuser)

        for _ in range(5):
            response = client.post(
                "/api/variant-lists/",
                {
                    "label": "A variant list",
                    "type": VariantList.Type.CUSTOM,
                    "metadata": {
                        "gnomad_version": "2.1.1",
                    },
                    "variants": [{"id": "1-55516888-G-GA"}],
                },
            )

            assert response.status_code == 201

        assert VariantList.objects.count() == 5

        response = client.post(
            "/api/variant-lists/",
            {
                "label": "A variant list",
                "type": VariantList.Type.CUSTOM,
                "metadata": {
                    "gnomad_version": "2.1.1",
                },
                "variants": [{"id": "1-55516888-G-GA"}],
            },
        )

        assert response.status_code == 400
        assert VariantList.objects.count() == 5


@pytest.mark.django_db
class TestGetVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        testuser = User.objects.create(username="testuser")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="inactivestaff", is_active=False, is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantList.objects.create(
            id=3,
            label="List 3",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(
            user=testuser,
            variant_list=list1,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=testuser,
            variant_list=list2,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=inactive_user,
            variant_list=list1,
            level=VariantListAccessPermission.Level.OWNER,
        )

    def test_viewing_variant_list_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "list_id,expected_response", [(1, 200), (2, 200), (3, 404)]
    )
    def test_viewing_variant_list_requires_permission(self, list_id, expected_response):
        variant_list = VariantList.objects.get(id=list_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="testuser"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == expected_response

    def test_inactive_users_cannot_view_variant_lists(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="inactiveuser"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "list_id,expected_access_level",
        [("1", "Editor"), ("2", "Viewer")],
    )
    def test_viewing_variant_list_includes_access_level(
        self, list_id, expected_access_level
    ):
        variant_list = VariantList.objects.get(id=list_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="testuser"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        variant_list = response.json()
        assert variant_list["access_level"] == expected_access_level

    @pytest.mark.parametrize("list_id", [1, 2, 3])
    def test_staff_users_can_view_all_lists(self, list_id):
        variant_list = VariantList.objects.get(id=list_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 200
        response = response.json()
        assert "access_level" not in response
        assert "access_permissions" in response

        # Staff member must be active
        client = APIClient()
        client.force_authenticate(User.objects.get(username="inactivestaff"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 403


@pytest.mark.django_db
class TestEditVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            notes="Initial notes",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            user=inactive_user,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )

    def test_editing_variant_list_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        initial_notes = variant_list.notes
        client = APIClient()
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/",
            {"notes": "Notes by anonymous"},
        )
        assert response.status_code == 403
        variant_list.refresh_from_db()
        assert variant_list.notes == initial_notes

    @pytest.mark.parametrize(
        "user,expected_response",
        [
            ("viewer", 403),
            ("editor", 200),
            ("owner", 200),
            ("other", 404),
            ("inactiveuser", 403),
            ("staffmember", 403),
        ],
    )
    def test_editing_variant_list_requires_permission(self, user, expected_response):
        variant_list = VariantList.objects.get(id=1)
        initial_notes = variant_list.notes
        client = APIClient()
        client.force_authenticate(User.objects.get(username=user))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/",
            {"notes": f"Notes by {user}"},
        )
        assert response.status_code == expected_response
        variant_list.refresh_from_db()
        if expected_response == 200:
            assert variant_list.notes == f"Notes by {user}"
        else:
            assert variant_list.notes == initial_notes


class TestDeleteVariantList:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True, scope="function")
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            user=inactive_user,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )

    @pytest.mark.django_db
    def test_deleting_variant_list_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.delete(
            f"/api/variant-lists/{variant_list.uuid}/",
        )
        assert response.status_code == 403
        assert VariantList.objects.count() == 1

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "user,expected_response",
        [
            ("viewer", 403),
            ("editor", 403),
            ("owner", 204),
            ("other", 404),
            ("inactiveuser", 403),
            ("staffmember", 403),
        ],
    )
    def test_deleting_variant_list_requires_permission(self, user, expected_response):
        assert VariantList.objects.count() == 1
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=user))
        response = client.delete(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == expected_response
        if expected_response == 204:
            assert VariantList.objects.count() == 0
        else:
            assert VariantList.objects.count() == 1
