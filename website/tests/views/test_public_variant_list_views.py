# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from calculator.models import (
    VariantList,
    VariantListAccessPermission,
    PublicVariantList,
)


User = get_user_model()


@pytest.mark.django_db
class TestCreatePublicVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        submitter = User.objects.create(username="submitter")
        User.objects.create(username="reviewer")
        User.objects.create(username="other")

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=submitter,
            level=VariantListAccessPermission.Level.OWNER,
        )

    def test_submitting_variant_list_for_public_approval_requires_authentication(self):
        client = APIClient()
        response = client.post(
            "/api/public-variant-lists/",
            {
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "submitter",
            },
        )
        assert response.status_code == 403

    def test_submitting_variant_list_for_public_approval_requires_permission(self):
        # Only variant list owners should be able to submit the variant list for public approval from staff
        client = APIClient()

        client.force_authenticate(User.objects.get(username="submitter"))
        response = client.post(
            "/api/public-variant-lists/",
            {
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "submitter",
            },
        )
        assert response.status_code == 201

        client.force_authenticate(User.objects.get(username="reviewer"))
        response = client.post(
            "/api/public-variant-lists/",
            {
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "reviewer",
            },
        )
        assert response.status_code == 403

    def test_submitting_variant_list_for_public_approval_stores_user(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="submitter"))
        client.post(
            "/api/public-variant-lists/",
            {
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "submitter",
            },
        )
        public_list = PublicVariantList.objects.get(
            variant_list=1, review_status=PublicVariantList.ReviewStatus.PENDING
        )
        assert public_list.submitted_by.username == "submitter"

    def test_submitting_public_variant_list_entry_creates_an_entry_and_returns_location(
        self,
    ):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="submitter"))
        assert PublicVariantList.objects.count() == 0
        response = client.post(
            "/api/public-variant-lists/",
            {
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "submitter",
            },
        )

        assert response.status_code == 201
        assert PublicVariantList.objects.count() == 1
        assert response.has_header("Location")
        assert response.headers["Location"] == "/api/public-variant-lists/1/"


@pytest.mark.django_db
class TestGetPublicVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        submitter = User.objects.create(username="submitter", is_staff=False)
        reviewer = User.objects.create(username="reviewer", is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "testgeneid",
                "gene_symbol": "testgenesymbol",
            },
            variants=["1-55516888-G-GA"],
        )

        list3 = VariantList.objects.create(
            id=3,
            label="List 3",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "testgeneid3",
                "gene_symbol": "testgenesymbol3",
            },
            variants=["1-55516888-G-GA"],
        )

        list4 = VariantList.objects.create(
            id=4,
            label="List 4",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "testgeneid4",
                "gene_symbol": "testgenesymbol4",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=submitter,
            level=VariantListAccessPermission.Level.OWNER,
        )

        PublicVariantList.objects.create(
            variant_list=list2,
            submitted_by=submitter,
            reviewed_by=reviewer,
            review_status=PublicVariantList.ReviewStatus.APPROVED,
        )

        PublicVariantList.objects.create(
            variant_list=list3,
            submitted_by=submitter,
            review_status=PublicVariantList.ReviewStatus.PENDING,
        )

        PublicVariantList.objects.create(
            variant_list=list4,
            submitted_by=submitter,
            review_status=PublicVariantList.ReviewStatus.REJECTED,
        )

    def test_viewing_public_variant_lists_does_not_require_authentication(self):
        client = APIClient()
        response = client.get("/api/public-variant-lists/")
        assert response.status_code == 200

    def test_viewing_public_variant_lists_requires_permissions(self):
        client = APIClient()

        # non-staff users only see approved lists, and have reduced fields returned to them
        client.force_authenticate(User.objects.get(username="submitter"))
        response = client.get("/api/public-variant-lists/")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert not any("review_status" in od for od in response.data)

        # staff user can see public lists of any status
        client.force_authenticate(User.objects.get(username="reviewer"))
        response = client.get("/api/public-variant-lists/")
        assert response.status_code == 200
        assert len(response.data) == 3
        assert any("Approved" in od.values() for od in response.data)
        assert any("Pending" in od.values() for od in response.data)
        assert any("Rejected" in od.values() for od in response.data)

    def test_viewing_public_variant_list_detail_requires_authentication(self):
        client = APIClient()
        response = client.get("/api/public-variant-lists/2/")
        assert response.status_code == 403

    def test_viewing_public_variant_list_detail_requires_permissions(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="submitter"))
        response = client.get("/api/public-variant-lists/2/")
        assert response.status_code == 200


@pytest.mark.django_db
class TestEditPublicVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        submitter = User.objects.create(username="submitter", is_staff=False)
        reviewer = User.objects.create(username="reviewer", is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "testgeneid",
                "gene_symbol": "testgenesymbol",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=submitter,
            level=VariantListAccessPermission.Level.OWNER,
        )

        PublicVariantList.objects.create(
            variant_list=list1,
            submitted_by=submitter,
            review_status=PublicVariantList.ReviewStatus.PENDING,
        )

        PublicVariantList.objects.create(
            variant_list=list2,
            submitted_by=submitter,
            reviewed_by=reviewer,
            review_status=PublicVariantList.ReviewStatus.APPROVED,
        )

    def test_editing_public_variant_list_requires_authentication(self):
        client = APIClient()

        response = client.patch(
            "/api/public-variant-lists/2/",
            {
                "review_status": PublicVariantList.ReviewStatus.APPROVED,
                "reviewed_by": "reviewer",
            },
        )
        assert response.status_code == 403

    def test_editing_public_variant_list_requires_permission(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="submitter"))
        response = client.patch(
            "/api/public-variant-lists/1/",
            {
                "review_status": PublicVariantList.ReviewStatus.APPROVED,
                "reviewed_by": "submitter",
            },
        )
        assert response.status_code == 403

        client.force_authenticate(User.objects.get(username="reviewer"))
        response = client.patch(
            "/api/public-variant-lists/1/",
            {
                "review_status": PublicVariantList.ReviewStatus.APPROVED,
                "reviewed_by": "reviewer",
            },
        )
        assert response.status_code == 200

    def test_staff_can_edit_public_variant_lists_multiple_times(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="reviewer"))
        response = client.patch(
            "/api/public-variant-lists/2/",
            {
                "review_status": PublicVariantList.ReviewStatus.REJECTED,
                "reviewed_by": "submitter",
            },
        )
        assert response.status_code == 200

        response = client.patch(
            "/api/public-variant-lists/2/",
            {
                "review_status": PublicVariantList.ReviewStatus.APPROVED,
                "reviewed_by": "submitter",
            },
        )
        assert response.status_code == 200


@pytest.mark.django_db
class TestDeletePublicVariantList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        submitter = User.objects.create(username="submitter", is_staff=False)
        reviewer = User.objects.create(username="reviewer", is_staff=True)
        User.objects.create(username="other", is_staff=False)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "testgeneid",
                "gene_symbol": "testgenesymbol",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            variant_list=list1,
            user=submitter,
            level=VariantListAccessPermission.Level.OWNER,
        )

        VariantListAccessPermission.objects.create(
            variant_list=list2,
            user=submitter,
            level=VariantListAccessPermission.Level.OWNER,
        )

        PublicVariantList.objects.create(
            variant_list=list1,
            submitted_by=submitter,
            review_status=PublicVariantList.ReviewStatus.PENDING,
        )

        PublicVariantList.objects.create(
            variant_list=list2,
            submitted_by=submitter,
            reviewed_by=reviewer,
            review_status=PublicVariantList.ReviewStatus.APPROVED,
        )

    def test_deleting_public_variant_list_requires_authentication(self):
        client = APIClient()
        assert PublicVariantList.objects.count() == 2
        response = client.delete("/api/public-variant-lists/2/")
        assert response.status_code == 403
        assert PublicVariantList.objects.count() == 2

    def test_deleting_public_variant_list_requires_permission(self):
        client = APIClient()
        assert PublicVariantList.objects.count() == 2

        # a user that is not an owner of the list cannot delete its public entry
        client.force_authenticate(User.objects.get(username="other"))
        response = client.delete("/api/public-variant-lists/2/")
        assert response.status_code == 403
        assert PublicVariantList.objects.count() == 2

        # An owner of the list can delete the public entry
        client.force_authenticate(User.objects.get(username="submitter"))
        response = client.delete("/api/public-variant-lists/2/")
        assert response.status_code == 204
        assert PublicVariantList.objects.count() == 1

        # a staff user can delete a public entry even if they are not an owner
        client.force_authenticate(User.objects.get(username="reviewer"))
        response = client.delete("/api/public-variant-lists/1/")
        assert response.status_code == 204
        assert PublicVariantList.objects.count() == 0
