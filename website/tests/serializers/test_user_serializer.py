# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model

from website.serializers import UserSerializer, NewUserSerializer, CurrentUserSerializer


User = get_user_model()


class TestUserSerializer:
    def test_serializers(self):
        serializer = UserSerializer(
            User(id=1, username="testuser"), data={"is_active": True, "is_staff": False}
        )
        assert serializer.is_valid(), serializer.errors

    def test_prevents_editing_ids(self):
        serializer = UserSerializer(
            User(id=1, username="testuser"), data={"id": 2, "is_active": True}
        )

        assert not serializer.is_valid()
        assert "id" in serializer.errors

        serializer = UserSerializer(
            User(id=1, username="testuser"),
            data={"username": "newusername", "is_active": True},
        )

        assert not serializer.is_valid()
        assert "username" in serializer.errors


@pytest.mark.django_db
class TestNewUserSerializer:
    def test_serializer(self):
        serializer = NewUserSerializer(
            data={"username": "newuser", "is_active": True, "is_staff": False}
        )
        assert serializer.is_valid(), serializer.errors

    def test_prevents_setting_id(self):
        serializer = NewUserSerializer(
            data={"id": 1, "username": "newuser", "is_active": True, "is_staff": False}
        )
        assert not serializer.is_valid()
        assert "id" in serializer.errors

    def test_validates_username(self):
        serializer = NewUserSerializer(
            data={"username": "#", "is_active": True, "is_staff": False}
        )
        assert not serializer.is_valid()
        assert "username" in serializer.errors


class TestCurrentUserSerializer:
    def test_serializer(self):
        user = User(username="testuser", is_active=True)
        serializer = CurrentUserSerializer(user)
        assert serializer.data == {
            "username": "testuser",
            "is_active": True,
        }

        user = User(username="inactiveuser", is_active=False)
        serializer = CurrentUserSerializer(user)
        assert serializer.data == {
            "username": "inactiveuser",
            "is_active": False,
        }

    def test_includes_staff_field_for_staff_users(self):
        user = User(username="staffmember", is_staff=True)
        serializer = CurrentUserSerializer(user)
        assert serializer.data == {
            "username": "staffmember",
            "is_active": True,
            "is_staff": True,
        }
