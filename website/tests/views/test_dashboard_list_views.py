# pylint: skip-file
import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from calculator.models import DashboardList
from calculator.serializers import (
    NewDashboardListSerializer,
    DashboardListSerializer,
)

User = get_user_model()

@pytest.mark.django_db
class TestGetDashboardLists:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        user1 = User.objects.create(username="User 1")
        user2 = User.objects.create(username="User 2")
        User.objects.create(username="staffuser", is_staff=True)

        list1 = DashboardList.objects.create(
            label="List 1",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            s=[{"id": "1-55516888-G-GA"}],
        )

        list2 = DashboardList.objects.create(
            label="List 2",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            label="List 3",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            label="List 4",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            label="List 5",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            label="List 6",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

class TestCreateDashboardList:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="testuser")

    @pytest.mark.django_db

    @pytest.mark.django_db
    def test_process_request_is_sent_to_worker(self, send_to_worker):
        client = APIClient()
        testuser = User.objects.get(username="testuser")
        client.force_authenticate(testuser)
        response = client.post(
            "/dashboard-lists/",
            {
                "label": "A dashboard list",
                "metadata": {
                    "gnomad_version": "2.1.1",
                },
                "variants": [{"id": "1-55516888-G-GA"}],
            },
        )

        response = client.get(response.headers["Location"]).json()
        dashboard_list = DashboardList.objects.get(uuid=response["uuid"])

        send_to_worker.assert_called_once_with(
            {"type": "dashboard-lists/<uuid:dashboard_list_id>/", "args": {"uuid": str(dashboard_list_id.uuid)}}
        )

@pytest.mark.django_db
class TestGetDashboardList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        staffuser = User.objects.create(username="staffmember", is_staff=True)
        testuser = User.objects.create(username="testuser")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="inactivestaff", is_active=False, is_staff=True)

        list1 = DashboardList.objects.create(
            id=1,
            label="List 1",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        list2 = DashboardList.objects.create(
            id=2,
            label="List 2",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid2",
                "gene_symbol": "testsymbol2",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        list3 = DashboardList.objects.create(
            id=3,
            label="List 3",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid3",
                "gene_symbol": "testsymbol3",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            id=4,
            label="List 4",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid4",
                "gene_symbol": "testsymbol4",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            id=5,
            label="List 5",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "testid5",
                "gene_symbol": "testsymbol5",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

@pytest.mark.django_db
class TestEditDashboardList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        staffmember = User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(
            username="inactivestaffmember", is_staff=True, is_active=False
        )
        User.objects.create(username="other")

        dashboard_list = DashboardList.objects.create(
            id=1,
            label="Test list",
            notes="Initial notes",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        DashboardList.objects.create(
            id=2,
            label="Test list 2",
            notes="Initial notes",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000115257",
                "gene_symbol": "PCSK4",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

        dashboard_list_2 = DashboardList.objects.create(
            id=3,
            label="Test list 3",
            notes="Initial notes",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000115257",
                "gene_symbol": "PCSK4",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )


class TestDeleteDashboardList:
    @pytest.mark.django_db
    @pytest.fixture(autouse=True, scope="function")
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="other")

        dashboard_list = DashboardList.objects.create(
            id=1,
            label="Test list",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

class TestProcessDashboardList:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        inactive_user = User.objects.create(username="inactiveuser", is_active=False)
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="other")

        dashboard_list = DashboardList.objects.create(
            id=1,
            label="Test list",
            notes="Initial notes",
            metadata={
                "version": "2",
                "gnomad_version": "2.1.1",
            },
            variants=[{"id": "1-55516888-G-GA"}],
        )

