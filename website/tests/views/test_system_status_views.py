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
