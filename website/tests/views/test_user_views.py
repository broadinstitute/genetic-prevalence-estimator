from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from calculator.models import VariantList


User = get_user_model()


class TestCreateUser:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="otheruser")

    @pytest.mark.django_db
    def test_requires_authentication(self):
        client = APIClient()
        response = client.post("/api/users/", {"username": "new_user"})
        assert response.status_code == 403
        assert User.objects.count() == 2

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "username,expected_status", [("staffmember", 201), ("otheruser", 403)]
    )
    def test_requires_staff(self, username, expected_status):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.post("/api/users/", {"username": "newuser"})
        assert response.status_code == expected_status
        if expected_status != 201:
            assert User.objects.count() == 2

    @pytest.mark.django_db
    def test_creates_user(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        client.post("/api/users/", {"username": "newuser"})
        assert User.objects.count() == 3
        assert User.objects.get(username="newuser")

    @pytest.mark.django_db
    def test_returns_url_for_user_detail(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        response = client.post("/api/users/", {"username": "newuser"})
        assert response.has_header("Location")
        newuser = User.objects.get(username="newuser")
        assert str(newuser.id) in response.headers["Location"]


@pytest.mark.django_db
class TestListUsers:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="otheruser")

    def test_requires_authentication(self):
        client = APIClient()
        response = client.get("/api/users/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,expected_status", [("staffmember", 200), ("otheruser", 403)]
    )
    def test_requires_staff(self, username, expected_status):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get("/api/users/")
        assert response.status_code == expected_status

    def test_lists_users(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        users = client.get("/api/users/").json()
        assert len(users) == 2
        assert set(u["username"] for u in users) == {"staffmember", "otheruser"}


@pytest.mark.django_db
class TestGetUser:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(id=1, username="staffmember", is_staff=True)
        User.objects.create(id=2, username="activeuser")
        User.objects.create(id=3, username="inactiveuser", is_active=False)

    def test_requires_authentication(self):
        client = APIClient()
        response = client.get(f"/api/users/{1}/")
        assert response.status_code == 403

    @pytest.mark.parametrize(
        "username,expected_status", [("staffmember", 200), ("activeuser", 403)]
    )
    def test_requires_staff(self, username, expected_status):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.get(f"/api/users/{1}/")
        assert response.status_code == expected_status

    @pytest.mark.parametrize("user_id", [1, 2, 3])
    def test_gets_user(self, user_id):
        user = User.objects.get(id=user_id)
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        response = client.get(f"/api/users/{user_id}/").json()
        assert response == {
            "id": user.id,
            "username": user.username,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "date_joined": user.date_joined.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "last_login": None,
            "last_variant_list_created_at": None,
        }


class TestEditUser:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(id=1, username="staffmember", is_staff=True)
        User.objects.create(id=2, username="otheruser")

    @pytest.mark.django_db
    def test_requires_authentication(self):
        client = APIClient()
        response = client.get(f"/api/users/{1}/")
        assert response.status_code == 403

    @pytest.mark.django_db
    @pytest.mark.parametrize(
        "username,expected_status", [("staffmember", 200), ("otheruser", 403)]
    )
    def test_requires_staff(self, username, expected_status):
        client = APIClient()
        client.force_authenticate(User.objects.get(username=username))
        response = client.patch(f"/api/users/{2}/", {"is_active": False})
        assert response.status_code == expected_status

    @pytest.mark.django_db
    def test_edits_user(self):
        user = User.objects.get(id=2)
        assert user.is_active
        assert not user.is_staff
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        response = client.patch(f"/api/users/{2}/", {"is_active": False})
        assert response.status_code == 200
        user.refresh_from_db()
        assert not user.is_active
        assert not user.is_staff

    @pytest.mark.django_db
    def test_user_cannot_edit_themself(self):
        user = User.objects.get(username="staffmember")
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.patch(f"/api/users/{user.id}/", {"is_active": False})
        assert response.status_code == 403
        user.refresh_from_db()
        assert user.is_active


@pytest.mark.django_db
class TestUserActivityFields:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        submitter = User.objects.create(
            username="submitter", last_login=timezone.now() - timedelta(days=3)
        )
        for days_ago in (10, 2):
            variant_list = VariantList.objects.create(
                label="List",
                type=VariantList.Type.CUSTOM,
                metadata={"version": "1", "gnomad_version": "4.1.0"},
                created_by=submitter,
            )
            VariantList.objects.filter(pk=variant_list.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )

    def get_users_by_username(self):
        client = APIClient()
        client.force_authenticate(User.objects.get(username="staffmember"))
        return {user["username"]: user for user in client.get("/api/users/").json()}

    def test_returns_last_login(self):
        submitter = User.objects.get(username="submitter")

        users = self.get_users_by_username()

        assert users["submitter"]["last_login"] == submitter.last_login.strftime(
            "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        assert users["staffmember"]["last_login"] is None

    def test_returns_most_recent_variant_list_creation(self):
        latest_created_at = (
            VariantList.objects.filter(created_by__username="submitter")
            .order_by("-created_at")
            .first()
            .created_at
        )

        users = self.get_users_by_username()

        assert users["submitter"][
            "last_variant_list_created_at"
        ] == latest_created_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        assert users["staffmember"]["last_variant_list_created_at"] is None
