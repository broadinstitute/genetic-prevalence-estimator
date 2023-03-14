# pylint: disable=no-self-use
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


User = get_user_model()


class TestAuth:
    @pytest.mark.django_db
    def test_signin(self):
        client = APIClient()
        response = client.post("/api/auth/signin/")
        assert response.status_code == 400
        assert response.wsgi_request.user.is_anonymous

        assert User.objects.count() == 0
        with patch(
            "website.views.auth.get_username_from_token", return_value="testuser"
        ):
            client = APIClient()
            response = client.post("/api/auth/signin/")
            assert response.status_code == 200
            assert User.objects.count() == 1
            user = User.objects.get(username="testuser")
            assert user == response.wsgi_request.user

    @pytest.mark.django_db
    def test_new_users_are_active_by_default(self):
        with patch(
            "website.views.auth.get_username_from_token", return_value="newuser"
        ):
            client = APIClient()
            client.post("/api/auth/signin/")

            user = User.objects.get(username="newuser")
            assert user.is_active

        User.objects.create(username="existinguser")
        with patch(
            "website.views.auth.get_username_from_token", return_value="existinguser"
        ):
            client = APIClient()
            client.post("/api/auth/signin/")

            user = User.objects.get(username="existinguser")
            assert user.is_active


@pytest.mark.django_db
class TestProfile:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="activeuser")
        User.objects.create(username="inactiveuser", is_active=False)

    def test_requires_authentication(self):
        client = APIClient()
        response = client.get("/api/auth/whoami/")
        assert response.status_code == 403

    @pytest.mark.parametrize("username", ["staffmember", "activeuser", "inactiveuser"])
    def test_returns_user_info(self, username):
        user = User.objects.get(username=username)
        client = APIClient()
        client.force_authenticate(user)
        response = client.get("/api/auth/whoami/").json()

        if user.is_staff:
            assert response == {
                "username": user.username,
                "is_active": user.is_active,
                "is_staff": user.is_staff,
            }
        else:
            assert response == {
                "username": user.username,
                "is_active": user.is_active,
            }
