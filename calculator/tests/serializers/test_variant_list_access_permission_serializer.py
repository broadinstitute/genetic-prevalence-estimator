# pylint: disable=no-self-use
import uuid

import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers import (
    NewVariantListAccessPermissionSerializer,
    VariantListAccessPermissionSerializer,
)


User = get_user_model()


def variant_list_fixture():
    return VariantList(
        id=1,
        uuid=uuid.uuid4(),
        label="A variant list",
        type=VariantList.Type.RECOMMENDED,
        metadata={
            "version": "2",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "include_gnomad_plof": True,
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )


def test_variant_list_access_serializer_only_allows_editing_level():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    access = VariantListAccessPermission(
        uuid=uuid.uuid4(),
        user=user,
        variant_list=variant_list,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    serializer = VariantListAccessPermissionSerializer(
        access, data={"level": VariantListAccessPermission.Level.EDITOR}, partial=True
    )
    assert serializer.is_valid(), serializer.errors

    serializer = VariantListAccessPermissionSerializer(
        access, data={"uuid": uuid.uuid4()}, partial=True
    )
    assert not serializer.is_valid()
    assert "uuid" in serializer.errors

    serializer = VariantListAccessPermissionSerializer(
        access, data={"user": "otheruser"}, partial=True
    )
    assert not serializer.is_valid()
    assert "user" in serializer.errors

    other_list = variant_list_fixture()
    serializer = VariantListAccessPermissionSerializer(
        access, data={"variant_list": other_list}, partial=True
    )
    assert not serializer.is_valid()


def test_variant_list_access_serializer_serializes_username():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    access = VariantListAccessPermission(
        uuid=uuid.uuid4(),
        user=user,
        variant_list=variant_list,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    serializer = VariantListAccessPermissionSerializer(access)
    assert serializer.data["user"] == "testuser"


def test_variant_list_access_serializer_serializes_level_label():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    access = VariantListAccessPermission(
        uuid=uuid.uuid4(),
        user=user,
        variant_list=variant_list,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    serializer = VariantListAccessPermissionSerializer(access)
    assert serializer.data["level"] == "Viewer"


@pytest.mark.django_db
class TestNewVariantListAccessPermissionSerializer:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        variant_list = variant_list_fixture()
        variant_list.id = 1
        variant_list.save()

        User.objects.create(username="testuser")

    def test_new_variant_list_access_serializer(self):
        serializer = NewVariantListAccessPermissionSerializer(
            data={
                "user": "testuser",
                "variant_list": VariantList.objects.get(id=1).uuid,
                "level": "Editor",
            }
        )
        assert serializer.is_valid(), serializer.errors

        serializer = NewVariantListAccessPermissionSerializer(
            data={
                "user": 12,
                "variant_list": VariantList.objects.get(id=1).uuid,
                "level": "Editor",
            }
        )
        assert not serializer.is_valid()
        assert "user" in serializer.errors

        serializer = NewVariantListAccessPermissionSerializer(
            data={"user": "testuser", "variant_list": "foo", "level": "Editor"}
        )
        assert not serializer.is_valid()
        assert "variant_list" in serializer.errors

        serializer = NewVariantListAccessPermissionSerializer(
            data={
                "user": "testuser",
                "variant_list": VariantList.objects.get(id=1).uuid,
                "level": "foo",
            }
        )
        assert not serializer.is_valid()
        assert "level" in serializer.errors

        serializer = NewVariantListAccessPermissionSerializer(
            data={
                "user": "testuser",
                "variant_list": VariantList.objects.get(id=1).uuid,
                "level": "Editor",
                "extra_field": "foo",
            }
        )
        assert not serializer.is_valid()
