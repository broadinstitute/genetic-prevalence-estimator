import re

from rest_framework import serializers

from calculator.constants import GNOMAD_VERSIONS, GNOMAD_REFERENCE_GENOMES
from calculator.models import DashboardList
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField


def is_gene_id(maybe_gene_id):
    return bool(re.fullmatch(r"ENSG\d{11}\.\d+", maybe_gene_id))


def is_transcript_id(maybe_transcript_id):
    return bool(re.fullmatch(r"ENST\d{11}\.\d+", maybe_transcript_id))


def is_variant_id(maybe_variant_id):
    return bool(re.fullmatch(r"(\d{1,2}|X|Y)-\d+-[ACGT]+-[ACGT]+", maybe_variant_id))


class MultipleChoiceField(serializers.MultipleChoiceField):
    def to_internal_value(self, data):
        return list(super().to_internal_value(data))

    def to_representation(self, value):
        return list(super().to_representation(value))


class DashboardListMetadataSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    gnomad_version = serializers.ChoiceField(GNOMAD_VERSIONS)
    reference_genome = serializers.SerializerMethodField()

    populations = serializers.ListField(child=serializers.CharField(), read_only=True)
    clinvar_version = serializers.CharField(max_length=10, read_only=True)

    gene_id = serializers.CharField(max_length=20, required=False)
    gene_symbol = serializers.CharField(max_length=20, read_only=True)
    transcript_id = serializers.CharField(max_length=20, required=False)

    include_gnomad_plof = serializers.BooleanField(required=False)
    include_clinvar_clinical_significance = MultipleChoiceField(
        [
            "pathogenic_or_likely_pathogenic",
            "conflicting_interpretations",
        ],
        required=False,
    )

    def get_reference_genome(self, obj):
        return GNOMAD_REFERENCE_GENOMES[obj["gnomad_version"]]

    def validate_gene_id(self, value):
        if value and not is_gene_id(value):
            raise serializers.ValidationError(f"'{value}' is not a valid gene ID.")
        return value

    def validate_transcript_id(self, value):
        if value and not is_transcript_id(value):
            raise serializers.ValidationError(
                f"'{value}' is not a valid transcript ID."
            )
        return value

    def validate(self, attrs):
        if any((attrs.get("gene_id"), attrs.get("transcript_id"))) and not all(
            (attrs.get("gene_id"), attrs.get("transcript_id"))
        ):
            raise serializers.ValidationError(
                "Both gene and transcript ID are required"
            )

        return attrs


class NewDashboardListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        metadata_serializer = DashboardListMetadataSerializer(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return metadata_serializer.validated_data

    class Meta:
        model = DashboardList
        fields = ["uuid", "label", "notes", "metadata", "variants"]
        read_only_fields = ["uuid"]


class DashboardListTopTenVariantSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    variantid = serializers.DecimalField(max_digits=50, decimal_places=15)
    AF = serializers.DecimalField(max_digits=50, decimal_places=15)
    AC = serializers.DecimalField(max_digits=50, decimal_places=15)
    AN = serializers.DecimalField(max_digits=50, decimal_places=15)
    genetic_ancestry_groups = serializers.JSONField(default=list)


class DashboardListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)
    status = ChoiceField(choices=DashboardList.Status.choices, read_only=True)
    metadata = serializers.SerializerMethodField()

    def get_metadata(self, obj):
        metadata_serializer = DashboardListMetadataSerializer(
            obj.metadata, context={"dashboard_list": obj}
        )
        data = metadata_serializer.data
        return data

    class Meta:
        model = DashboardList

        fields = [
            "uuid",
            "label",
            "notes",
            "metadata",
            "created_at",
            "updated_at",
            "status",
            "error",
            "variants",
            "top_ten_variants",
        ]

        read_only_fields = [
            f
            for f in fields
            if f
            not in (
                "label",
                "notes",
            )
        ]
