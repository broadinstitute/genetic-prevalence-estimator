import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from calculator.models import VariantList


User = get_user_model()


@pytest.mark.django_db
class TestGetSystemStatus:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="otheruser")

        def create_variant_list(status):
            VariantList.objects.create(
                label="List 1",
                type=VariantList.Type.CUSTOM,
                metadata={
                    "version": "1",
                    "reference_genome": "GRCh37",
                    "gnomad_version": "2.1.1",
                },
                variants=[{"id": "1-55516888-G-GA"}],
                status=status,
            )

        create_variant_list(VariantList.Status.READY)
        create_variant_list(VariantList.Status.READY)
        create_variant_list(VariantList.Status.QUEUED)
        create_variant_list(VariantList.Status.ERROR)

    def test_requires_authentication(self):
        client = APIClient()
        response = client.get("/api/status/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,expected_status", [("staffmember", 200), ("otheruser", 403)]
    )
    def test_requires_staff(self, username, expected_status):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get("/api/status/")
        assert response.status_code == expected_status

    def test_returns_number_of_variant_lists_grouped_by_status(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        status = client.get("/api/status/").json()

        assert status["variant_lists"] == {
            "Queued": 1,
            "Processing": 0,
            "Ready": 2,
            "Error": 1,
        }


@pytest.mark.django_db
class TestGetSystemStatusQueuedAndProcessingLists:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        staff_member = User.objects.create(username="staffmember", is_staff=True)
        submitter = User.objects.create(username="submitter")

        def create_variant_list(label, status, created_by, metadata=None):
            return VariantList.objects.create(
                label=label,
                type=VariantList.Type.CUSTOM,
                metadata={
                    "version": "1",
                    "reference_genome": "GRCh38",
                    "gnomad_version": "4.1.0",
                    **(metadata or {}),
                },
                status=status,
                created_by=created_by,
            )

        create_variant_list(
            "Queued list",
            VariantList.Status.QUEUED,
            submitter,
            {"gene_symbol": "PCSK9"},
        )
        create_variant_list("Processing list", VariantList.Status.PROCESSING, None)
        create_variant_list("Ready list", VariantList.Status.READY, staff_member)
        create_variant_list("Error list", VariantList.Status.ERROR, staff_member)

    def get_queued_and_processing_lists(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        return client.get("/api/status/").json()["queued_and_processing_lists"]

    def test_returns_only_queued_and_processing_lists_oldest_first(self):
        lists = self.get_queued_and_processing_lists()
        assert [(vlist["label"], vlist["status"]) for vlist in lists] == [
            ("Queued list", "Queued"),
            ("Processing list", "Processing"),
        ]

    def test_returns_submitter_and_gene_details(self):
        queued_list, processing_list = self.get_queued_and_processing_lists()

        assert queued_list["uuid"] == str(
            VariantList.objects.get(label="Queued list").uuid
        )
        assert queued_list["created_by"] == "submitter"
        assert queued_list["gene_symbol"] == "PCSK9"
        assert queued_list["gnomad_version"] == "4.1.0"
        assert queued_list["created_at"]
        assert queued_list["updated_at"]

        assert processing_list["created_by"] is None
        assert processing_list["gene_symbol"] is None
