# pylint: disable=no-self-use
import uuid

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError


from calculator.models import (
    VariantList,
    VariantListAccessPermission,
    PublicVariantList,
)


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


class TestPublicVariantList:
    @pytest.mark.django_db
    def test_deleting_variant_list_deletes_public_variant_list(self):
        submitter = User.objects.create(username="submitter", is_staff=False)
        reviewer = User.objects.create(username="reviewer", is_staff=True)

        variant_list = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        PublicVariantList.objects.create(
            variant_list=variant_list,
            submitted_by=submitter,
            reviewed_by=reviewer,
            public_status=PublicVariantList.PublicStatus.REJECTED,
        )

        assert PublicVariantList.objects.count() == 1
        variant_list.delete()
        assert PublicVariantList.objects.count() == 0

    @pytest.mark.django_db
    def test_duplicate_genes_lists_cannot_be_submitted(self):
        submitter = User.objects.create(username="submitter", is_staff=False)
        reviewer = User.objects.create(username="reviewer", is_staff=True)

        list1 = VariantList.objects.create(
            id=1,
            label="List 1",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        # A public list can be created if there are no existing approved lists with the same gene_id
        PublicVariantList.objects.create(
            variant_list=list1,
            submitted_by=submitter,
            reviewed_by=reviewer,
            public_status=PublicVariantList.PublicStatus.REJECTED,
        )

        list2 = VariantList.objects.create(
            id=2,
            label="List 2",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        # A public list can still be created if there's an existing list with a the same gene_id that is not approved
        PublicVariantList.objects.create(
            variant_list=list2,
            submitted_by=submitter,
            reviewed_by=reviewer,
            public_status=PublicVariantList.PublicStatus.APPROVED,
        )

        list3 = VariantList.objects.create(
            id=3,
            label="List 3",
            type=VariantList.Type.CUSTOM,
            metadata={
                "version": "1",
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "gene_symbol": "PCSK9",
            },
            variants=["1-55516888-G-GA"],
        )

        with pytest.raises(IntegrityError):
            # A public list cannot be created if there's an existing approved list with the same gene_id
            PublicVariantList.objects.create(
                variant_list=list3,
                submitted_by=submitter,
                reviewed_by=reviewer,
                public_status=PublicVariantList.PublicStatus.PENDING,
            )
