# pylint: disable=no-self-use
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from calculator.models import VariantList, VariantListAccessPermission


User = get_user_model()


class TestVariantList:
    @pytest.mark.django_db
    def test_uuid_is_unique(self):
        uid = uuid.uuid4()

        VariantList.objects.create(
            uuid=uid,
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        with pytest.raises(IntegrityError):
            VariantList.objects.create(
                uuid=uid,
                id=2,
                label="List 2",
                type=VariantList.Type.CUSTOM,
                metadata={
                    "version": "1",
                    "reference_genome": "GRCh37",
                    "gnomad_version": "2.1.1",
                },
                variants=["1-55516888-G-GA"],
            )


class TestVariantListAccessPermission:
    @pytest.mark.django_db
    def test_uuid_is_unique(self):
        user1 = User.objects.create(username="user1")
        user2 = User.objects.create(username="user2")

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        uid = uuid.uuid4()
        VariantListAccessPermission.objects.create(
            uuid=uid, user=user1, variant_list=list1
        )
        with pytest.raises(IntegrityError):
            VariantListAccessPermission.objects.create(
                uuid=uid, user=user2, variant_list=list2
            )

    @pytest.mark.django_db
    def test_deleting_variant_list_deletes_permission_models(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            user=viewer,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )
        VariantListAccessPermission.objects.create(
            user=editor,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.EDITOR,
        )
        VariantListAccessPermission.objects.create(
            user=owner,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.OWNER,
        )

        assert VariantListAccessPermission.objects.count() == 3
        variant_list.delete()
        assert VariantListAccessPermission.objects.count() == 0

    @pytest.mark.django_db
    def test_access_level_is_unique(self):
        user = User.objects.create(username="testuser")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            variants=["1-55516888-G-GA"],
        )

        VariantListAccessPermission.objects.create(
            user=user,
            variant_list=variant_list,
            level=VariantListAccessPermission.Level.VIEWER,
        )

        with pytest.raises(IntegrityError):
            VariantListAccessPermission.objects.create(
                user=user,
                variant_list=variant_list,
                level=VariantListAccessPermission.Level.EDITOR,
            )
