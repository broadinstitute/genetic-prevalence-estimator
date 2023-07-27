# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from calculator.models import (
    VariantList,
    VariantListAccessPermission,
    VariantListAnnotation,
    PublicVariantList,
)


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
    def test_process_request_is_sent_to_worker(self, send_to_worker):
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

        response = client.get(response.headers["Location"]).json()
        variant_list = VariantList.objects.get(uuid=response["uuid"])

        send_to_worker.assert_called_once_with(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

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
        staffuser = User.objects.create(username="staffmember", is_staff=True)
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
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
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
                "gene_id": "testid2",
                "gene_symbol": "testsymbol2",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        list3 = VariantList.objects.create(
            id=3,
            label="List 3",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid3",
                "gene_symbol": "testsymbol3",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantList.objects.create(
            id=4,
            label="List 4",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid4",
                "gene_symbol": "testsymbol4",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        list5 = VariantList.objects.create(
            id=5,
            label="List 5",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid5",
                "gene_symbol": "testsymbol5",
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

        VariantListAccessPermission.objects.create(
            user=inactive_user,
            variant_list=list3,
            level=VariantListAccessPermission.Level.OWNER,
        )

        PublicVariantList.objects.create(
            variant_list=list1,
            review_status=PublicVariantList.ReviewStatus.APPROVED,
            submitted_by=testuser,
            reviewed_by=staffuser,
        )

        PublicVariantList.objects.create(
            variant_list=list2,
            review_status=PublicVariantList.ReviewStatus.PENDING,
            submitted_by=testuser,
            reviewed_by=staffuser,
        )

        PublicVariantList.objects.create(
            variant_list=list3,
            review_status=PublicVariantList.ReviewStatus.REJECTED,
            submitted_by=testuser,
            reviewed_by=staffuser,
        )

        PublicVariantList.objects.create(
            variant_list=list5,
            review_status=PublicVariantList.ReviewStatus.APPROVED,
            submitted_by=testuser,
            reviewed_by=staffuser,
        )

    def test_viewing_variant_list_does_not_require_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 200

    @pytest.mark.parametrize(
        "username,list_id,expected_response",
        [
            ("anon", 1, 200),
            ("anon", 2, 404),
            ("anon", 3, 404),
            ("anon", 4, 404),
            ("anon", 5, 200),
            ("testuser", 1, 200),
            ("testuser", 2, 200),
            ("testuser", 3, 404),
            ("testuser", 4, 404),
            ("testuser", 5, 200),
        ],
    )
    def test_viewing_variant_list_requires_permission_unless_variant_list_is_public(
        self, username, list_id, expected_response
    ):
        variant_list = VariantList.objects.get(id=list_id)
        client = APIClient()

        if username != "anon":
            client.force_authenticate(User.objects.get(username=username))

        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == expected_response

    def test_inactive_users_cannot_view_non_public_variant_lists(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="inactiveuser"))

        public_variant_list = VariantList.objects.get(id=1)
        response = client.get(f"/api/variant-lists/{public_variant_list.uuid}/")
        assert response.status_code == 200

        private_variant_list = VariantList.objects.get(id=3)
        response = client.get(f"/api/variant-lists/{private_variant_list.uuid}/")
        assert response.status_code == 404

    @pytest.mark.parametrize(
        "username,list_id,access_level_expected_in_response, expected_access_level",
        [
            ("testuser", "1", True, "Editor"),
            ("testuser", "2", True, "Viewer"),
            ("testuser", "5", False, "n/a"),
            ("anon", "1", False, "n/a"),
        ],
    )
    def test_viewing_variant_list_includes_access_level_unless_viewing_public_list_when_not_a_collaborator(
        self,
        username,
        list_id,
        access_level_expected_in_response,
        expected_access_level,
    ):
        client = APIClient()

        if username != "anon":
            client.force_authenticate(User.objects.get(username="testuser"))

        variant_list = VariantList.objects.get(id=list_id)
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        response = response.json()

        if access_level_expected_in_response:
            assert "access_level" in response
            assert response["access_level"] == expected_access_level
        else:
            assert "access_level" not in response

    @pytest.mark.parametrize(
        "list_id, expected_response", [(1, 200), (2, 404), (3, 404)]
    )
    def test_staff_users_can_view_all_lists(self, list_id, expected_response):
        variant_list = VariantList.objects.get(id=list_id)
        client = APIClient()

        # Staff members who are active can view any list
        client.force_authenticate(User.objects.get(username="staffmember"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == 200
        response = response.json()
        assert "access_level" not in response
        assert "access_permissions" in response

        # Staff members whoare inactive can only view public lists
        client.force_authenticate(User.objects.get(username="inactivestaff"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/")
        assert response.status_code == expected_response


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
            ("other", 403),
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
            ("other", 403),
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


@pytest.mark.django_db
class TestProcessVariantList:
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
            status=VariantList.Status.READY,
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

    def test_process_variant_list_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.post(
            f"/api/variant-lists/{variant_list.uuid}/process/",
        )
        assert response.status_code == 403

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
    def test_process_variant_list_requires_permission(self, user, expected_response):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=user))
        response = client.post(f"/api/variant-lists/{variant_list.uuid}/process/")
        assert response.status_code == expected_response

    def test_process_variant_list_sends_request_to_worker(self, send_to_worker):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(f"/api/variant-lists/{variant_list.uuid}/process/")

        send_to_worker.assert_called_once_with(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

    def test_process_variant_list_marks_variant_list_as_queued(self):
        variant_list = VariantList.objects.get(id=1)
        assert variant_list.status == VariantList.Status.READY

        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(f"/api/variant-lists/{variant_list.uuid}/process/")

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.QUEUED


@pytest.mark.django_db
class TestVariantListVariantsView:
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
            status=VariantList.Status.READY,
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

    def test_variant_list_variants_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )
        assert response.status_code == 403

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
    def test_variant_list_variants_requires_permission(self, user, expected_response):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=user))
        response = client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )
        assert response.status_code == expected_response

    @pytest.mark.parametrize(
        "request_data,expected_response",
        [
            ({}, 400),  # missing variants
            ({"variants": "1-100-A-T"}, 400),  # wrong data type
            ({"variants": [1, 2, 3]}, 400),  # wrong data type
            ({"variants": ["1-55516888-G-GA"]}, 400),  # duplicate variants
            ({"variants": ["1-55505452-T-G"]}, 200),  # valid
        ],
    )
    def test_variant_list_variants_validates_variants(
        self, request_data, expected_response
    ):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        response = client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/", request_data
        )
        assert response.status_code == expected_response

    def test_variant_list_variants_saves_new_variants(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )

        variant_list.refresh_from_db()

        assert [variant["id"] for variant in variant_list.variants] == [
            "1-55516888-G-GA",
            "1-55505452-T-G",
        ]

    def test_variant_list_variants_sends_request_to_worker(self, send_to_worker):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )

        send_to_worker.assert_called_once_with(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

    def test_variant_list_variants_marks_variant_list_as_queued(self):
        variant_list = VariantList.objects.get(id=1)
        assert variant_list.status == VariantList.Status.READY

        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.QUEUED

    @pytest.mark.parametrize(
        "status,expected_to_succeed",
        [
            (VariantList.Status.QUEUED, False),
            (VariantList.Status.PROCESSING, False),
            (VariantList.Status.READY, True),
            (VariantList.Status.ERROR, True),
        ],
    )
    def test_variant_list_variants_can_only_be_changed_if_list_is_ready_or_errored(
        self, status, expected_to_succeed
    ):
        editor = User.objects.get(username="editor")

        variant_list = VariantList.objects.create(
            label="Test list",
            notes="Initial notes",
            type=VariantList.Type.CUSTOM,
            status=status,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )

        client = APIClient()
        client.force_authenticate(editor)
        response = client.post(
            f"/api/variant-lists/{variant_list.uuid}/variants/",
            {"variants": ["1-55505452-T-G"]},
        )

        variant_list.refresh_from_db()
        if expected_to_succeed:
            assert response.status_code == 200
            assert len(variant_list.variants) == 2
        else:
            assert response.status_code == 400
            assert len(variant_list.variants) == 1


@pytest.mark.django_db
class TestGetVariantListAnnotation:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        owner = User.objects.create(username="owner")
        editor = User.objects.create(username="editor")
        viewer = User.objects.create(username="viewer")
        inactive_editor = User.objects.create(
            username="inactive_editor", is_active=False
        )
        User.objects.create(username="other_user")
        User.objects.create(username="staff_member", is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[
                {"id": "1-55516888-G-A"},
                {"id": "1-55516888-G-GA"},
            ],
        )

        VariantListAnnotation.objects.create(
            user=editor,
            variant_list=list1,
            selected_variants=["1-55516888-G-A"],
            variant_notes={"1-55516888-G-A": "Test note"},
        )

        VariantListAccessPermission.objects.create(
            user=owner,
            variant_list=list1,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=list1,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=inactive_editor,
            variant_list=list1,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=viewer,
            variant_list=list1,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    def test_viewing_variant_list_annotation_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/annotation/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,expected_response",
        [
            ("owner", 200),
            ("editor", 200),
            ("viewer", 404),
            ("other_user", 404),
            ("staff_member", 404),
        ],
    )
    def test_viewing_variant_list_annotation_requires_permission(
        self, username, expected_response
    ):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/annotation/")
        assert response.status_code == expected_response

    def test_inactive_users_cannot_view_annotation(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="inactive_editor"))
        response = client.get(f"/api/variant-lists/{variant_list.uuid}/annotation/")
        assert response.status_code == 403

    def test_empty_annotation_is_automatically_created(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="owner"))
        response = client.get(
            f"/api/variant-lists/{variant_list.uuid}/annotation/"
        ).json()
        assert response == {
            "selected_variants": [],
            "variant_notes": {},
        }

    def test_get_annotation(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="editor"))
        response = client.get(
            f"/api/variant-lists/{variant_list.uuid}/annotation/"
        ).json()
        assert response == {
            "selected_variants": ["1-55516888-G-A"],
            "variant_notes": {"1-55516888-G-A": "Test note"},
        }


@pytest.mark.django_db
class TestEditVariantListAnnotation:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        owner = User.objects.create(username="owner")
        editor = User.objects.create(username="editor")
        viewer = User.objects.create(username="viewer")
        inactive_editor = User.objects.create(
            username="inactive_editor", is_active=False
        )
        User.objects.create(username="other_user")
        User.objects.create(username="staff_member", is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[
                {"id": "1-55516888-G-A"},
                {"id": "1-55516888-G-GA"},
            ],
        )

        VariantListAccessPermission.objects.create(
            user=owner,
            variant_list=list1,
            level=VariantListAccessPermission.Level.OWNER,
        )
        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=list1,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=inactive_editor,
            variant_list=list1,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=viewer,
            variant_list=list1,
            level=VariantListAccessPermission.Level.VIEWER,
        )

    def test_editing_variant_list_annotation_requires_authentication(self):
        variant_list = VariantList.objects.get(id=1)
        initial_notes = variant_list.notes
        client = APIClient()
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/annotation/",
            {"selected_variants": ["1-55516888-G-GA"]},
        )
        assert response.status_code == 403
        variant_list.refresh_from_db()
        assert variant_list.notes == initial_notes

    @pytest.mark.parametrize(
        "username,expected_response",
        [
            ("owner", 200),
            ("editor", 200),
            ("viewer", 404),
            ("other_user", 404),
            ("staff_member", 404),
        ],
    )
    def test_editing_variant_list_requires_permission(
        self, username, expected_response
    ):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/annotation/",
            {"selected_variants": ["1-55516888-G-GA"]},
        )
        assert response.status_code == expected_response

        if expected_response == 200:
            annotation = variant_list.annotations.get(user__username=username)
            assert annotation.selected_variants == ["1-55516888-G-GA"]
        else:
            assert variant_list.annotations.filter(user__username=username).count() == 0

    def test_inactive_users_cannot_annotate(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="inactive_editor"))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/annotation/",
            {"selected_variants": ["1-55516888-G-GA"]},
        )
        assert response.status_code == 403

    def test_edit_variant_list_annotation(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="editor"))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/annotation/",
            {"selected_variants": ["1-55516888-G-GA"]},
        )
        assert response.status_code == 200, response.json()
        assert response.json() == {
            "selected_variants": ["1-55516888-G-GA"],
            "variant_notes": {},
        }

    def test_edit_variant_list_annotation_validation(self):
        variant_list = VariantList.objects.get(id=1)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="editor"))
        response = client.patch(
            f"/api/variant-lists/{variant_list.uuid}/annotation/",
            {"selected_variants": ["not-a-variant"]},
        )
        assert response.status_code == 400
