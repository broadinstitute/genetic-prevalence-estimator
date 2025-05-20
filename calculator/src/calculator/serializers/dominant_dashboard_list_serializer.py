import re

from rest_framework import serializers

from calculator.constants import GNOMAD_VERSIONS, GNOMAD_REFERENCE_GENOMES
from calculator.models import DominantDashboardList
from calculator.serializers.serializer import ModelSerializer


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


class DominantDashboardListMetadataSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    gnomad_version = serializers.ChoiceField(GNOMAD_VERSIONS)
    reference_genome = serializers.SerializerMethodField()

    gene_id = serializers.CharField(max_length=20, required=False)
    gene_symbol = serializers.CharField(max_length=20)
    transcript_id = serializers.CharField(max_length=20, required=False)

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


class NewDominantDashboardListSerializer(ModelSerializer):
    metadata = serializers.JSONField()

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        metadata_serializer = DominantDashboardListMetadataSerializer(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return metadata_serializer.validated_data

    class Meta:
        model = DominantDashboardList
        fields = [
            "gene_id",
            "date_created",
            "metadata",
            "de_novo_variant_calculations",
            "inheritance_type",
        ]


class DominantDashboardListDashboardSerializer(ModelSerializer):
    gene_symbol = serializers.CharField(source="metadata.gene_symbol", read_only=True)

    class Meta:
        model = DominantDashboardList
        fields = [
            "gene_id",
            "gene_symbol",
            "metadata",
            "inheritance_type",
        ]
        read_only_fields = list(fields)


class DominantDashboardListSerializer(ModelSerializer):
    metadata = serializers.JSONField()

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        metadata_serializer = DominantDashboardListMetadataSerializer(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return metadata_serializer.validated_data

    class Meta:
        model = DominantDashboardList

        fields = [
            "gene_id",
            "date_created",
            "metadata",
            "de_novo_variant_calculations",
            "inheritance_type",
        ]

        read_only_fields = [
            f
            for f in fields
            if f
            not in (
                "date_created",
                "metadata",
                "de_novo_variant_calculations",
                "inheritance_type",
            )
        ]
