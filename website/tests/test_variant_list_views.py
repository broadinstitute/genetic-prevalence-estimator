# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from calculator.models import VariantList, VariantListAccess


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
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(variant_list=list1, user=user1)
        VariantListAccess.objects.create(variant_list=list1, user=user2)

        list2 = VariantList.objects.create(
            label="List 2",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(variant_list=list2, user=user1)

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
        response = client.get("/api/variant-lists/").json()
        variant_lists = response["variant_lists"]

        print(variant_lists)

        assert len(variant_lists) == len(expected_lists)
        assert (
            set(variant_list["label"] for variant_list in variant_lists)
            == expected_lists
        )


@pytest.mark.django_db
class TestCreateVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="testuser")

    def test_creating_variant_list_requires_authentication(self):
        client = APIClient()
        response = client.post(
            "/api/variant-lists/",
            {
                "label": "A variant list",
                "type": "custom",
                "definition": {"version": "1", "reference_genome": "GRCh37"},
                "variants": ["1-55516888-G-GA"],
            },
        )
        assert response.status_code == 403
        assert VariantList.objects.count() == 0

    def test_user_is_assigned_ownership_of_new_list(self):
        client = APIClient()
        testuser = User.objects.get(username="testuser")
        client.force_authenticate(testuser)
        response = client.post(
            "/api/variant-lists/",
            {
                "label": "A variant list",
                "type": "custom",
                "definition": {"version": "1", "reference_genome": "GRCh37"},
                "variants": ["1-55516888-G-GA"],
            },
        )

        assert response.status_code == 200
        assert VariantList.objects.count() == 1

        uuid = response.json()["variant_list"]["uuid"]
        variant_list = VariantList.objects.get(uuid=uuid)

        access = VariantListAccess.objects.get(variant_list=variant_list, user=testuser)
        assert access
        assert access.level == VariantListAccess.Level.OWNER


@pytest.mark.django_db
class TestGetVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        testuser = User.objects.create(username="testuser")

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantList.objects.create(
            id=3,
            label="List 3",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=testuser, variant_list=list1, level=VariantListAccess.Level.EDITOR
        )
        VariantListAccess.objects.create(
            user=testuser, variant_list=list2, level=VariantListAccess.Level.VIEWER
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


@pytest.mark.django_db
class TestEditVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            description="Initial description",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=viewer, variant_list=variant_list, level=VariantListAccess.Level.VIEWER
        )
        VariantListAccess.objects.create(
            user=editor, variant_list=variant_list, level=VariantListAccess.Level.EDITOR
        )
        VariantListAccess.objects.create(
            user=owner, variant_list=variant_list, level=VariantListAccess.Level.OWNER
        )

    def test_editing_variant_list_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        initial_description = variant_list.description
        client = APIClient()
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/",
            {"description": "Description by anonymous"},
        )
        assert response.status_code == 403
        variant_list.refresh_from_db()
        assert variant_list.description == initial_description

    @pytest.mark.parametrize(
        "user,expected_response",
        [("viewer", 403), ("editor", 200), ("owner", 200), ("other", 404)],
    )
    def test_editing_variant_list_requires_permission(self, user, expected_response):
        variant_list = VariantList.objects.get(id=1)
        initial_description = variant_list.description
        client = APIClient()
        client.force_authenticate(User.objects.get(username=user))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/",
            {"description": f"Description by {user}"},
        )
        assert response.status_code == expected_response
        variant_list.refresh_from_db()
        if expected_response == 200:
            assert variant_list.description == f"Description by {user}"
        else:
            assert variant_list.description == initial_description


class TestDeleteVariantList:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True, scope="function")
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            description="Initial description",
            type=VariantList.Type.CUSTOM,
            definition={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=viewer, variant_list=variant_list, level=VariantListAccess.Level.VIEWER
        )
        VariantListAccess.objects.create(
            user=editor, variant_list=variant_list, level=VariantListAccess.Level.EDITOR
        )
        VariantListAccess.objects.create(
            user=owner, variant_list=variant_list, level=VariantListAccess.Level.OWNER
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
        [("viewer", 403), ("editor", 403), ("owner", 204), ("other", 404)],
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
