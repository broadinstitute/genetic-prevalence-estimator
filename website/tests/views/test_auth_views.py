from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from calculator.models import (
    VariantList,
    VariantListAccessPermission,
)

from website.scripts.merge_duplicate_users import process_duplicate_users

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
    def test_signin_merges_case_insensitive_sharing_created_user_stub(self):
        stub_uppercase_email = "Test.User@example.com"
        stub_uppercase_user = User.objects.create(
            username=stub_uppercase_email, email=stub_uppercase_email
        )

        variant_list = VariantList.objects.create(
            id=1,
            label="Test List",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            user=stub_uppercase_user,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )

        with patch(
            "website.views.auth.get_username_from_token",
            return_value="test.user@example.com",  # here email is all lowercase from mock API response
        ):
            client = APIClient()
            response = client.post("/api/auth/signin/", {"token": "fake_google_token"})
            assert response.status_code == 200
            assert (
                User.objects.count() == 1
            ), "A duplicate user was created instead of linking!"

            stub_uppercase_user.refresh_from_db()
            assert stub_uppercase_user.variant_list_access_permissions.count() == 1

    @pytest.mark.django_db
    def test_signin_merges_case_insensitive_google_user(self):
        stub_uppercase_email = "Test.UseR@exAmple.com"
        stub_uppercase_user = User.objects.create(
            username=stub_uppercase_email, email=stub_uppercase_email
        )

        variant_list = VariantList.objects.create(
            id=1,
            label="Test List",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            user=stub_uppercase_user,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )

        with patch(
            "website.views.auth.get_username_from_token",
            return_value="TEST.user@example.com",  # here email is all lowercase from mock API response
        ):
            client = APIClient()
            response = client.post("/api/auth/signin/", {"token": "fake_google_token"})
            assert response.status_code == 200
            assert (
                User.objects.count() == 1
            ), "A duplicate user was created instead of linking!"

            stub_uppercase_user.refresh_from_db()
            assert stub_uppercase_user.variant_list_access_permissions.count() == 1


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


@pytest.mark.django_db
class TestCleanupScripts:
    def test_merge_duplicate_users_script(self):
        stub_user_1 = User.objects.create(
            username="Dupe@example.com",
            email="Dupe@example.com",
            last_login=None,
        )
        google_user_1 = User.objects.create(
            username="dupe@example.com",
            email="dupe@example.com",
            last_login=timezone.now(),
        )

        # stub_user_2 = User.objects.create(
        #     username="teST@exaMPLE.com",
        #     email="teST@exaMPLE.com"
        #     last_login=None,
        # )
        # google_user_2 = User.objects.create(
        #     username="TEst@EXAmple.com",
        #     email="TEst@EXAmple.com",
        #     last_login=timezone.now()
        # )

        variant_list_1 = VariantList.objects.create(
            id=1,
            label="Test List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            user=stub_user_1,
            variant_list=variant_list_1,
            level=VariantListAccessPermission.Level.EDITOR,
        )

        # variant_list_2 = VariantList.objects.create(
        #     id=2,
        #     label="Test List 2",
        #     type=VariantList.Type.CUSTOM,
        #     metadata={
        #         "version": "1",
        #         "reference_genome": "GRCh37",
        #         "gnomad_version": "2.1.1",
        #     },
        #     variants=["1-55516888-G-TA"],
        # )

        # VariantListAccessPermission.objects.create(
        #     user=stub_user_2,
        #     variant_list=variant_list_2,
        #     level=VariantListAccessPermission.Level.EDITOR
        # )

        # Confirm our bad state exists before running the script
        # assert User.objects.count() == 4
        assert User.objects.count() == 2
        assert stub_user_1.variant_list_access_permissions.count() == 1
        assert google_user_1.variant_list_access_permissions.count() == 0

        success_1 = process_duplicate_users("dupe@example.com", dry_run=False)
        assert success_1 is True
        assert User.objects.count() == 1, "The stub user was not deleted"
        google_user_1.refresh_from_db()
        assert (
            google_user_1.variant_list_access_permissions.count() == 1
        ), "Permissions were not moved to the Google user!"

        # assert User.objects.count() == 3
        # assert stub_user_2.variant_list_access_permissions.count() == 1
        # assert google_user_2.variant_list_access_permissions.count() == 0
        # success_2 = merge_duplicate_users("dupe@example.com")
        # assert success_1 is True
        # assert User.objects.count() == 3, "The stub user was not deleted"
        # google_user_1.refresh_from_db()
        # assert google_user_1.variant_list_access_permissions.count() == 1, "Permissions were not moved to the Google user!"
