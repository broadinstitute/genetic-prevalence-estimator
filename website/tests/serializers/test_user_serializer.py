# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model

from website.serializers import UserSerializer, NewUserSerializer


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
