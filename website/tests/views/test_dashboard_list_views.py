# pylint: disable=too-many-lines
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from calculator.models import (
    DashboardList,
)


User = get_user_model()


@pytest.mark.django_db
class TestDashboardListsLoadView:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="User 1")
        User.objects.create(username="staffuser", is_staff=True)

    def test_posting_to_dashboard_lists_load_view_requires_authentication(self):
        client = APIClient()

        file_content = b"Test, Hello, Yes\n1, 2, 3"
        mock_file = SimpleUploadedFile(
            "test.csv", file_content, content_type="text/csv"
        )
        form_data = {
            "csv_file": mock_file,
        }

        response = client.post("/api/dashboard-lists/load", data=form_data)
        assert response.status_code == 403

    # There's some intentional jank here, rather than submitting a fully correctly formed CSV, we submit a stub
    #   for both requests,
    #     - 'User 1' is not staff and we expect 403 forbidden
    #     - 'staffuser' is staff, and thus we expect 400 bad request, due to the stub of a .csv
    #       importantly, the staff user does not get a 403
    @pytest.mark.parametrize(
        "username, expected_response", [("User 1", 403), ("staffuser", 400)]
    )
    def test_posting_to_dashboard_lists_load_view_requires_permission(
        self, username, expected_response
    ):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))

        file_content = b"Test, Hello, Yes\n1, 2, 3"
        mock_file = SimpleUploadedFile(
            "test.csv", file_content, content_type="text/csv"
        )
        form_data = {
            "csv_file": mock_file,
        }

        response = client.post("/api/dashboard-lists/load", data=form_data)
        assert response.status_code == expected_response


@pytest.mark.django_db
class TestDashboardListsView:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="User 1")
        User.objects.create(username="staffuser", is_staff=True)

        DashboardList.objects.create(
            gene_id="ENSG00000094914",
            label="AAAS - Dashboard",
            notes="This list was algorithmically generated ...",
            created_at="2024-05-14T21:49:36.005507Z",
            metadata={
                "gnomad_version": "4.1.0",
                "reference_genome": "GRCh38",
                "populations": [
                    "afr",
                    "amr",
                    "asj",
                    "eas",
                    "fin",
                    "mid",
                    "nfe",
                    "remaining",
                    "sas",
                ],
                "clinvar_version": "2024-04-21",
                "gene_id": "ENSG00000094914.14",
                "gene_symbol": "AAAS",
                "transcript_id": "ENST00000209873.9",
                "include_gnomad_plof": True,
                "include_gnomad_missense_with_high_revel_score": False,
                "include_clinvar_clinical_significance": [
                    "pathogenic_or_likely_pathogenic"
                ],
            },
            variant_calculations={
                "prevalence": [],
                "carrier_frequency": [],
                "carrier_frequency_simplified": [],
                "carrier_frequency_raw_numbers": [],
            },
            genetic_prevalence_orphanet="",
            genetic_prevalence_genereviews="",
            genetic_prevalence_other="",
            genetic_incidence_other="",
            inheritance_type="AR",
            top_ten_variants=[],
            status="R",
            error=None,
        )

    def test_getting_dashboard_lists_does_not_require_authentication(self):
        client = APIClient()
        response = client.get("/api/dashboard-lists/")
        assert response.status_code == 200

    @pytest.mark.parametrize("username", ["User 1", "staffuser"])
    def test_getting_dashboard_lists_does_not_require_permission(self, username):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))

        response = client.get("/api/dashboard-lists/")

        assert response.status_code == 200

    def test_getting_a_single_dashboard_list_does_not_require_authentication(self):
        client = APIClient()
        response = client.get("/api/dashboard-lists/ENSG00000094914/")
        assert response.status_code == 200

    @pytest.mark.parametrize("username", ["User 1", "staffuser"])
    def test_getting_a_single_dashboard_list_does_not_require_permission(
        self, username
    ):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))

        response = client.get("/api/dashboard-lists/ENSG00000094914/")

        assert response.status_code == 200
