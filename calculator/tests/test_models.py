# pylint: disable=no-self-use
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError

from calculator.models import VariantList, VariantListAccess


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
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        with pytest.raises(IntegrityError):
            VariantList.objects.create(
                uuid=uid,
                id=2,
                label="List 2",
                type=VariantList.Type.CUSTOM,
                metadata={"version": "1", "reference_genome": "GRCh37"},
                variants=["1-55516888-G-GA"],
            )


class TestVariantListAccess:
    @pytest.mark.django_db
    def test_uuid_is_unique(self):
        user1 = User.objects.create(username="user1")
        user2 = User.objects.create(username="user2")

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        uid = uuid.uuid4()
        VariantListAccess.objects.create(uuid=uid, user=user1, variant_list=list1)
        with pytest.raises(IntegrityError):
            VariantListAccess.objects.create(uuid=uid, user=user2, variant_list=list2)

    @pytest.mark.django_db
    def test_deleting_variant_list_deletes_permission_models(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            description="Initial description",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=viewer, variant_list=variant_list, level=VariantListAccess.Level.VIEWER
        )
        VariantListAccess.objects.create(
            user=editor, variant_list=variant_list, level=VariantListAccess.Level.EDITOR
        )
        VariantListAccess.objects.create(
            user=owner, variant_list=variant_list, level=VariantListAccess.Level.OWNER
        )

        assert VariantListAccess.objects.count() == 3
        variant_list.delete()
        assert VariantListAccess.objects.count() == 0

    @pytest.mark.django_db
    def test_access_level_is_unique(self):
        user = User.objects.create(username="testuser")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            description="Initial description",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=user, variant_list=variant_list, level=VariantListAccess.Level.VIEWER
        )

        with pytest.raises(IntegrityError):
            VariantListAccess.objects.create(
                user=user,
                variant_list=variant_list,
                level=VariantListAccess.Level.EDITOR,
            )
