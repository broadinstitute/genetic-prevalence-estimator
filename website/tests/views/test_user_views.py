import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


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
