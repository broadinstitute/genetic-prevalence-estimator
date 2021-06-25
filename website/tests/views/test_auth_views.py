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
    def test_new_users_are_inactive_by_default(self):
        with patch(
            "website.views.auth.get_username_from_token", return_value="newuser"
        ):
            client = APIClient()
            client.post("/api/auth/signin/")

            user = User.objects.get(username="newuser")
            assert not user.is_active

        User.objects.create(username="existinguser")
        with patch(
            "website.views.auth.get_username_from_token", return_value="existinguser"
        ):
            client = APIClient()
            client.post("/api/auth/signin/")

            user = User.objects.get(username="existinguser")
            assert user.is_active
