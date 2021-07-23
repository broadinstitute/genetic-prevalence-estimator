# pylint: disable=no-self-use
import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers import (
    NewVariantListSerializer,
    VariantListSerializer,
)


User = get_user_model()


def test_new_variant_list_serializer_custom_variant_list():
    # Valid variant list
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "notes": "",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "GRCh37",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert serializer.is_valid(), serializer.errors

    # Reject extra fields
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "GRCh37",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
            "other_field": "value",
        }
    )
    assert not serializer.is_valid()

    # Require a label
    serializer = NewVariantListSerializer(
        data={
            "label": "",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "GRCh37",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "label" in serializer.errors

    # Require a metadata
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {},
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Require a valid metadata version
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "9000",
                "reference_genome": "GRCh38",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Require a valid reference genome
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "1",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "reference_genome" in serializer.errors["metadata"]

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "foo",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "reference_genome" in serializer.errors["metadata"]

    # Require variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "GRCh37",
            },
            "variants": [],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    # Require valid variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "custom",
            "metadata": {
                "version": "1",
                "reference_genome": "GRCh37",
            },
            "variants": ["not-a-variant-id"],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors


def test_new_variant_list_serializer_gnomad_variant_list():
    # Valid variant lists
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert serializer.is_valid(), serializer.errors

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": ["pathogenic"],
            },
        }
    )
    assert serializer.is_valid(), serializer.errors

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": ["pathogenic", "uncertain"],
            },
        }
    )
    assert serializer.is_valid(), serializer.errors

    # Reject extra fields
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
            "other_field": "value",
        }
    )
    assert not serializer.is_valid()

    # Require label
    serializer = NewVariantListSerializer(
        data={
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "label" in serializer.errors

    # Require metadata
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {},
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Require a valid metadata version
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "9000",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Require valid gnomAD version
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gnomad_version" in serializer.errors["metadata"]

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "8",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gnomad_version" in serializer.errors["metadata"]

    # Require valid gene ID
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "3.1.1",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gene_id" in serializer.errors["metadata"]

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "3.1.1",
                "gene_id": "not-a-gene-id",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gene_id" in serializer.errors["metadata"]

    # Require valid transcript ID
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "3.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": None,
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "transcript_id" in serializer.errors["metadata"]

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "3.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "not-a-tx-id",
                "filter_clinvar_clinical_significance": None,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "transcript_id" in serializer.errors["metadata"]

    # Require valid ClinVar clinical significances
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": ["not-a-clinical-significance"],
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "filter_clinvar_clinical_significance" in serializer.errors["metadata"]

    # Do not allow variants to be uploaded
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "gnomad",
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174",
                "transcript_id": "ENST00000302118",
                "filter_clinvar_clinical_significance": None,
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors


def test_new_variant_list_serializer_invalid_type():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "invalid-type",
            "metadata": {
                "version": "1",
            },
            "variants": ["1-55516888-G-GA", "1-55516888-G-A"],
        }
    )
    assert not serializer.is_valid()
    assert "type" in serializer.errors


def gnomad_variant_list():
    return VariantList(
        id=1,
        uuid=uuid.uuid4(),
        label="A gnomAD variant list",
        type=VariantList.Type.GNOMAD,
        metadata={
            "version": "1",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174",
            "transcript_id": "ENST00000302118",
            "filter_clinvar_clinical_significance": None,
        },
        variants=["1-55516888-G-GA"],
        status=VariantList.Status.READY,
    )


def test_update_variant_list_serializer():
    # Changes to label and notes are allowed
    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list, data={"label": "A new label"}, partial=True
    )
    assert serializer.is_valid(), serializer.errors

    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list, data={"notes": "This is a test variant list."}, partial=True
    )
    assert serializer.is_valid(), serializer.errors

    # Other fields cannot be updated
    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list, data={"type": VariantList.Type.CUSTOM}, partial=True
    )
    assert not serializer.is_valid()
    assert "type" in serializer.errors

    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list,
        data={"variants": ["1-55516888-G-GA", "1-55516888-G-A"]},
        partial=True,
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list, data={"status": VariantList.Status.PROCESSING}, partial=True
    )
    assert not serializer.is_valid()
    assert "status" in serializer.errors

    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(
        variant_list, data={"access_permissions": []}, partial=True
    )
    assert not serializer.is_valid()


@pytest.mark.django_db
def test_variant_list_serializer_serializes_status_for_display():
    variant_list = gnomad_variant_list()
    serializer = VariantListSerializer(variant_list)
    assert serializer.data["status"] == "Ready"


@pytest.mark.django_db
def test_variant_list_serializer_serializes_access_level():
    editor = User.objects.create(username="editor")
    viewer = User.objects.create(username="viewer")

    variant_list = gnomad_variant_list()
    variant_list.save()

    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=editor,
        level=VariantListAccessPermission.Level.EDITOR,
    )
    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=viewer,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    with patch.object(VariantListSerializer, "get_current_user", return_value=editor):
        serializer = VariantListSerializer(variant_list)
        assert serializer.data["access_level"] == "Editor"

    with patch.object(VariantListSerializer, "get_current_user", return_value=viewer):
        serializer = VariantListSerializer(variant_list)
        assert serializer.data["access_level"] == "Viewer"

    serializer = VariantListSerializer(variant_list)
    assert "access_level" not in serializer.data


@pytest.mark.django_db
def test_variant_list_serializer_serializes_access_permissions_for_owners():
    owner = User.objects.create(username="owner")
    editor = User.objects.create(username="editor")
    viewer = User.objects.create(username="viewer")

    variant_list = gnomad_variant_list()
    variant_list.save()

    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=owner,
        level=VariantListAccessPermission.Level.OWNER,
    )
    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=editor,
        level=VariantListAccessPermission.Level.EDITOR,
    )
    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=viewer,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    # Owners should see other users with access to the variant list.
    with patch.object(VariantListSerializer, "get_current_user", return_value=owner):
        serializer = VariantListSerializer(variant_list)
        assert "access_permissions" in serializer.data
        access_permissions = serializer.data["access_permissions"]
        assert len(access_permissions) == 3
        assert {
            permission["user"]: permission["level"] for permission in access_permissions
        } == {
            "owner": "Owner",
            "editor": "Editor",
            "viewer": "Viewer",
        }

    # Users with access is read only.
    with patch.object(VariantListSerializer, "get_current_user", return_value=owner):
        serializer = VariantListSerializer(
            variant_list,
            data={"access_permissions": []},
            partial=True,
        )
        assert not serializer.is_valid()
        assert "access_permissions" in serializer.errors

    # Non-owners should not be able to see users with access to the variant list.

    with patch.object(VariantListSerializer, "get_current_user", return_value=editor):
        serializer = VariantListSerializer(variant_list)
        assert "access_permissions" not in serializer.data

    with patch.object(VariantListSerializer, "get_current_user", return_value=viewer):
        serializer = VariantListSerializer(variant_list)
        assert "access_permissions" not in serializer.data

    serializer = VariantListSerializer(variant_list)
    assert "access_permissions" not in serializer.data


@pytest.mark.django_db
def test_variant_list_serializer_includes_error_for_staff_users():
    staffmember = User.objects.create(username="staffmember", is_staff=True)
    owner = User.objects.create(username="owner")
    editor = User.objects.create(username="editor")
    viewer = User.objects.create(username="viewer")
    otheruser = User.objects.create(username="other")

    variant_list = gnomad_variant_list()
    variant_list.error = "Something went wrong"
    variant_list.save()

    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=owner,
        level=VariantListAccessPermission.Level.OWNER,
    )
    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=editor,
        level=VariantListAccessPermission.Level.EDITOR,
    )
    VariantListAccessPermission.objects.create(
        variant_list=variant_list,
        user=viewer,
        level=VariantListAccessPermission.Level.VIEWER,
    )

    serializer = VariantListSerializer(variant_list)
    assert "error" not in serializer.data

    for user in [owner, editor, viewer, otheruser]:
        with patch.object(VariantListSerializer, "get_current_user", return_value=user):
            serializer = VariantListSerializer(variant_list)
            assert "error" not in serializer.data

    with patch.object(
        VariantListSerializer, "get_current_user", return_value=staffmember
    ):
        serializer = VariantListSerializer(variant_list)
        assert "error" in serializer.data
        assert serializer.data["error"] == "Something went wrong"
