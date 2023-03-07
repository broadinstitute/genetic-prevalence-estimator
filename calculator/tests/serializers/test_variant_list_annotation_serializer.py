# pylint: disable=redefined-outer-name
import uuid

import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList, VariantListAnnotation
from calculator.serializers import VariantListAnnotationSerializer


User = get_user_model()


@pytest.fixture
def annotation():
    user = User(username="testuser")

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
        },
        variants=[
            {"id": "1-55516888-G-A"},
            {"id": "1-55516888-G-GA"},
        ],
        status=VariantList.Status.READY,
    )

    annotation = VariantListAnnotation(
        user=user,
        variant_list=variant_list,
    )

    return annotation


def test_variant_list_annotation_serializer_valid_annotation(annotation):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={
            "selected_variants": ["1-55516888-G-A"],
            "variant_notes": {
                "1-55516888-G-A": "Test note",
            },
        },
    )
    assert serializer.is_valid(), serializer.errors


def test_variant_list_annotation_serializer_rejects_extra_fields(annotation):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={
            "selected_variants": ["1-55516888-G-A"],
            "variant_notes": {
                "1-55516888-G-A": "Test note",
            },
            "other_field": "value",
        },
    )
    assert not serializer.is_valid()


@pytest.mark.parametrize(
    "selected_variants",
    [
        {},
        "invalid",
        ["not-a-variant"],
    ],
)
def test_variant_list_annotation_serializer_selected_variants_requires_list_of_variant_ids(
    annotation, selected_variants
):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={"selected_variants": selected_variants},
    )
    assert not serializer.is_valid()
    assert "selected_variants" in serializer.errors


def test_variant_list_annotation_serializer_selected_variants_requires_variants_in_list(
    annotation,
):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={"selected_variants": ["1-55505464-G-C"]},
    )
    assert not serializer.is_valid()
    assert "selected_variants" in serializer.errors


@pytest.mark.parametrize(
    "variant_notes",
    [
        "notes",
        ["1-55516888-G-A", "notes"],
        {"1-55516888-G-A": 100},
        {"not-a-variant": "notes"},
    ],
)
def test_variant_list_annotation_serializer_variant_notes_requires_mapping_of_variant_ids_to_notes(
    annotation, variant_notes
):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={"variant_notes": variant_notes},
    )
    assert not serializer.is_valid()
    assert "variant_notes" in serializer.errors


def test_variant_list_annotation_serializer_variant_notes_requires_variants_in_list(
    annotation,
):
    serializer = VariantListAnnotationSerializer(
        annotation,
        data={"variant_notes": ["1-55505464-G-C"]},
    )
    assert not serializer.is_valid()
    assert "variant_notes" in serializer.errors
