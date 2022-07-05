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


@pytest.mark.parametrize(
    "data",
    [
        {
            "label": "my new variant list",
            "notes": "",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        },
        {
            "label": "my new variant list",
            "notes": "",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174.9",
                "transcript_id": "ENST00000302118.5",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        },
        {
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174.9",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
            },
        },
        {
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174.9",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
                "include_clinvar_clinical_significance": [
                    "pathogenic_or_likely_pathogenic"
                ],
            },
        },
    ],
)
def test_new_variant_list_serializer_valid_variant_lists(data):
    serializer = NewVariantListSerializer(data=data)
    assert serializer.is_valid(), serializer.errors


def test_new_variant_list_serializer_rejects_extra_fields():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
            "other_field": "value",
        }
    )
    assert not serializer.is_valid()


def test_new_variant_list_serializer_requires_label():
    serializer = NewVariantListSerializer(
        data={
            "label": "",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "reference_genome": "GRCh37",
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "label" in serializer.errors


def test_new_variant_list_serializer_invalid_type():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": "invalid-type",
            "metadata": {},
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "type" in serializer.errors


def test_new_variant_list_serializer_metadata_required():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {},
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors


def test_new_variant_list_serializer_metadata_version():
    # Version is included in validated data
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert serializer.is_valid()
    assert serializer.validated_data["metadata"]["version"] == "2"

    # Reject custom version
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "version": "1",
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "version" in serializer.errors["metadata"]


def test_new_variant_list_serializer_metadata_gnomad_version():
    # Require a valid version of gnomAD
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "reference_genome": "GRCh37",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gnomad_version" in serializer.errors["metadata"]

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "reference_genome": "GRCh37",
                "gnomad_version": "0.1",
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gnomad_version" in serializer.errors["metadata"]


def test_new_variant_list_serializer_metadata_gene_and_transcript():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "gene_id": "ENSG00000169174.11",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
            },
        }
    )
    assert serializer.is_valid(), serializer.errors

    # Require transcript ID if automatically including variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "include_gnomad_plof": True,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "include_clinvar_clinical_significance": [
                    "pathogenic_or_likely_pathogenic"
                ],
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Require both gene and transcript if one is provided
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "gene_id": "ENSG00000169174.11",
                "include_gnomad_plof": True,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    # Validate gene ID
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "gene_id": "not-a-gene-id",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "gene_id" in serializer.errors["metadata"]

    # Validate transcript ID
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "3.1.2",
                "gene_id": "ENSG00000169174.11",
                "transcript_id": "not-a-transcript-id",
                "include_gnomad_plof": True,
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "transcript_id" in serializer.errors["metadata"]


def test_new_variant_list_serializer_metadata_clinvar():
    # Require valid ClinVar clinical significances
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174.9",
                "transcript_id": "ENST00000302118.5",
                "include_clinvar_clinical_significance": [
                    "not-a-clinical-significance"
                ],
            },
        }
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors
    assert "include_clinvar_clinical_significance" in serializer.errors["metadata"]


def test_new_variant_list_serializer_variants():
    # Require variants if not automatically adding variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    # Reject variants if automatically adding variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.RECOMMENDED,
            "metadata": {
                "gnomad_version": "2.1.1",
                "gene_id": "ENSG00000169174.9",
                "transcript_id": "ENST00000302118.5",
                "include_gnomad_plof": True,
            },
            "variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    # Require valid variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"field": "value"}],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": "not-a-variant-id"}],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    # Limit number of variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [{"id": f"1-{pos}-C-G"} for pos in range(1, 10_000)],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    # Require unique variants
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [
                {"id": "1-55512222-C-G"},
                {"id": "1-55505697-AC-A"},
                {"id": "1-55512222-C-G"},
            ],
        }
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors


@pytest.mark.django_db
def test_variant_list_serializer_persists_metadata_version():
    serializer = NewVariantListSerializer(
        data={
            "label": "my new variant list",
            "type": VariantList.Type.CUSTOM,
            "metadata": {
                "gnomad_version": "2.1.1",
            },
            "variants": [
                {"id": "1-55512222-C-G"},
                {"id": "1-55505697-AC-A"},
            ],
        }
    )
    assert serializer.is_valid()
    serializer.save()
    assert VariantList.objects.count() == 1
    assert VariantList.objects.get().metadata["version"] == "2"


@pytest.mark.django_db
def test_serialize_v2_variant_list_metadata():
    variant_list = VariantList(
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
            "include_clinvar_clinical_significance": [],
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )

    serializer = VariantListSerializer(variant_list)
    assert serializer.data["metadata"] == {
        "gnomad_version": "2.1.1",
        "reference_genome": "GRCh37",
        "gene_id": "ENSG00000169174.9",
        "transcript_id": "ENST00000302118.5",
        "include_gnomad_plof": True,
        "include_clinvar_clinical_significance": [],
    }


@pytest.mark.django_db
def test_serialize_v1_recommended_variant_list_metadata():
    variant_list = VariantList(
        id=1,
        uuid=uuid.uuid4(),
        label="A variant list",
        type=VariantList.Type.RECOMMENDED,
        metadata={
            "version": "1",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "included_clinvar_variants": ["pathogenic_or_likely_pathogenic"],
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )

    serializer = VariantListSerializer(variant_list)
    assert serializer.data["metadata"] == {
        "gnomad_version": "2.1.1",
        "reference_genome": "GRCh37",
        "gene_id": "ENSG00000169174.9",
        "transcript_id": "ENST00000302118.5",
        "include_gnomad_plof": True,
        "include_clinvar_clinical_significance": ["pathogenic_or_likely_pathogenic"],
    }


@pytest.mark.django_db
def test_serialize_v1_custom_variant_list_metadata():
    variant_list = VariantList(
        id=1,
        uuid=uuid.uuid4(),
        label="A variant list",
        type=VariantList.Type.CUSTOM,
        metadata={
            "version": "1",
            "gnomad_version": "2.1.1",
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )

    serializer = VariantListSerializer(variant_list)
    assert serializer.data["metadata"] == {
        "gnomad_version": "2.1.1",
        "reference_genome": "GRCh37",
        "include_gnomad_plof": False,
        "include_clinvar_clinical_significance": [],
    }


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
            "include_clinvar_clinical_significance": [],
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )


def test_update_variant_list_serializer():
    # Changes to label and notes are allowed
    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"label": "A new label"}, partial=True
    )
    assert serializer.is_valid(), serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"notes": "This is a test variant list."}, partial=True
    )
    assert serializer.is_valid(), serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(variant_list, data={"notes": ""}, partial=True)
    assert serializer.is_valid(), serializer.errors

    # Other fields cannot be updated
    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"type": VariantList.Type.CUSTOM}, partial=True
    )
    assert not serializer.is_valid()
    assert "type" in serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"metadata": {}}, partial=True
    )
    assert not serializer.is_valid()
    assert "metadata" in serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list,
        data={"variants": [{"id": "1-55516888-G-GA"}, {"id": "1-55516888-G-A"}]},
        partial=True,
    )
    assert not serializer.is_valid()
    assert "variants" in serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"status": VariantList.Status.PROCESSING}, partial=True
    )
    assert not serializer.is_valid()
    assert "status" in serializer.errors

    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(
        variant_list, data={"access_permissions": []}, partial=True
    )
    assert not serializer.is_valid()


@pytest.mark.django_db
def test_variant_list_serializer_serializes_status_for_display():
    variant_list = variant_list_fixture()
    serializer = VariantListSerializer(variant_list)
    assert serializer.data["status"] == "Ready"


@pytest.mark.django_db
def test_variant_list_serializer_serializes_access_level():
    editor = User.objects.create(username="editor")
    viewer = User.objects.create(username="viewer")

    variant_list = variant_list_fixture()
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

    variant_list = variant_list_fixture()
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

    variant_list = variant_list_fixture()
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
