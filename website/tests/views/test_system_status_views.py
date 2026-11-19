from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from calculator.models import VariantList
from website.views.system_status_views import variant_list_bucket


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


@pytest.mark.django_db
class TestGetSystemStatusErrorDetails:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        submitter = User.objects.create(username="submitter")

        def create_variant_list(label, status, error=None):
            return VariantList.objects.create(
                label=label,
                type=VariantList.Type.CUSTOM,
                metadata={
                    "version": "1",
                    "reference_genome": "GRCh38",
                    "gnomad_version": "4.1.0",
                    "gene_symbol": "PCSK9",
                },
                status=status,
                error=error,
                created_by=submitter,
            )

        create_variant_list(
            "Older error", VariantList.Status.ERROR, "Hail JVM exited with code 137"
        )
        create_variant_list("Newer error", VariantList.Status.ERROR)
        create_variant_list("Ready list", VariantList.Status.READY)

    def get_error_details(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        return client.get("/api/status/").json()["error_details"]

    def test_returns_errored_lists_most_recently_updated_first(self):
        assert [vlist["label"] for vlist in self.get_error_details()] == [
            "Newer error",
            "Older error",
        ]

    def test_returns_error_with_submitter_and_gene_details(self):
        newer_error, older_error = self.get_error_details()

        assert older_error["error"] == "Hail JVM exited with code 137"
        assert older_error["status"] == "Error"
        assert older_error["created_by"] == "submitter"
        assert older_error["gene_symbol"] == "PCSK9"
        assert older_error["gnomad_version"] == "4.1.0"
        assert older_error["created_at"]
        assert older_error["updated_at"]

        assert newer_error["error"] == ""


@pytest.mark.parametrize(
    "age,expected_bucket",
    [
        (timedelta(minutes=29), "active"),
        (timedelta(minutes=30), "stuck"),
        (timedelta(days=6, hours=23), "stuck"),
        (timedelta(days=7), "abandoned"),
    ],
)
def test_variant_list_bucket(age, expected_bucket):
    now = timezone.now()
    assert variant_list_bucket(now - age, now) == expected_bucket


@pytest.mark.django_db
class TestGetSystemStatusCounts:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        now = timezone.now()

        def create_variant_list(label, status, updated_ago, created_ago=None):
            variant_list = VariantList.objects.create(
                label=label,
                type=VariantList.Type.CUSTOM,
                metadata={
                    "version": "1",
                    "reference_genome": "GRCh38",
                    "gnomad_version": "4.1.0",
                },
                status=status,
            )
            VariantList.objects.filter(pk=variant_list.pk).update(
                updated_at=now - updated_ago,
                created_at=now - (created_ago or updated_ago),
            )

        create_variant_list(
            "Active", VariantList.Status.PROCESSING, timedelta(minutes=5)
        )
        create_variant_list("Stuck", VariantList.Status.QUEUED, timedelta(hours=2))
        create_variant_list(
            "Stuck longer", VariantList.Status.QUEUED, timedelta(days=3)
        )
        create_variant_list("Abandoned", VariantList.Status.QUEUED, timedelta(days=30))
        create_variant_list(
            "Recently ready",
            VariantList.Status.READY,
            timedelta(hours=1),
            created_ago=timedelta(days=60),
        )
        create_variant_list("Old ready", VariantList.Status.READY, timedelta(days=60))
        create_variant_list("Recent error", VariantList.Status.ERROR, timedelta(days=1))
        create_variant_list("Old error", VariantList.Status.ERROR, timedelta(days=90))

    def get_status(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        return client.get("/api/status/").json()

    def test_returns_right_now_counts(self):
        right_now = self.get_status()["counts"]["right_now"]

        assert right_now["active"] == 1
        assert right_now["stuck"] == 2
        assert right_now["oldest_stuck_updated_at"] == VariantList.objects.get(
            label="Stuck longer"
        ).updated_at.isoformat().replace("+00:00", "Z")
        assert right_now["last_ready_at"] == VariantList.objects.get(
            label="Recently ready"
        ).updated_at.isoformat().replace("+00:00", "Z")

    def test_returns_recent_counts(self):
        assert self.get_status()["counts"]["recent"] == {
            "created": 4,
            "ready": 1,
            "error": 1,
        }

    def test_returns_all_time_counts(self):
        assert self.get_status()["counts"]["all_time"] == {
            "total": 8,
            "ready": 2,
            "error": 2,
            "abandoned": 1,
        }

    def test_returns_thresholds(self):
        assert self.get_status()["thresholds"] == {
            "stuck_after_minutes": 30,
            "abandoned_after_days": 7,
            "recent_days": 7,
        }

    def test_tags_queued_and_processing_lists_with_bucket(self):
        lists = self.get_status()["queued_and_processing_lists"]

        assert {vlist["label"]: vlist["bucket"] for vlist in lists} == {
            "Active": "active",
            "Stuck": "stuck",
            "Stuck longer": "stuck",
            "Abandoned": "abandoned",
        }
