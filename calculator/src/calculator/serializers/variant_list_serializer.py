import re

from rest_framework import serializers

from calculator.constants import GNOMAD_VERSIONS, GNOMAD_REFERENCE_GENOMES
from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField
from calculator.serializers.variant_list_access_permission_serializer import (
    VariantListAccessPermissionSerializer,
)


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


class VariantListV2MetadataSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    version = serializers.ChoiceField(["2"], default="2")

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

    def get_reference_genome(self, obj):  # pylint: disable=no-self-use
        return GNOMAD_REFERENCE_GENOMES[obj["gnomad_version"]]

    def validate_gene_id(self, value):  # pylint: disable=no-self-use
        if value and not is_gene_id(value):
            raise serializers.ValidationError(f"'{value}' is not a valid gene ID.")
        return value

    def validate_transcript_id(self, value):  # pylint: disable=no-self-use
        if value and not is_transcript_id(value):
            raise serializers.ValidationError(
                f"'{value}' is not a valid transcript ID."
            )
        return value

    def validate(self, attrs):  # pylint: disable=no-self-use
        if attrs.get("include_gnomad_plof") or attrs.get(
            "include_clinvar_clinical_significance"
        ):
            if not attrs.get("transcript_id"):
                raise serializers.ValidationError(
                    "Transcript ID is required to automatically include variants"
                )

        if any((attrs.get("gene_id"), attrs.get("transcript_id"))) and not all(
            (attrs.get("gene_id"), attrs.get("transcript_id"))
        ):
            raise serializers.ValidationError(
                "Both gene and transcript ID are required"
            )

        return attrs


class VariantListV1MetadataSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    gnomad_version = serializers.ChoiceField(GNOMAD_VERSIONS)
    reference_genome = serializers.SerializerMethodField()
    populations = serializers.ListField(child=serializers.CharField(), read_only=True)
    clinvar_version = serializers.CharField(max_length=10, read_only=True)

    gene_id = serializers.CharField(max_length=20, required=False)
    transcript_id = serializers.CharField(max_length=20, required=False)

    include_gnomad_plof = serializers.SerializerMethodField()
    include_clinvar_clinical_significance = serializers.SerializerMethodField()

    def get_reference_genome(self, obj):  # pylint: disable=no-self-use
        return GNOMAD_REFERENCE_GENOMES[obj["gnomad_version"]]

    def get_include_gnomad_plof(self, obj):  # pylint: disable=unused-argument
        return self.context["variant_list"].type == VariantList.Type.RECOMMENDED

    def get_include_clinvar_clinical_significance(
        self, obj
    ):  # pylint: disable=no-self-use
        return obj.get("included_clinvar_variants", [])


class NewVariantListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate_metadata(self, value):  # pylint: disable=no-self-use
        if not value:
            raise serializers.ValidationError("This field is required.")

        metadata_serializer = VariantListV2MetadataSerializer(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return metadata_serializer.validated_data

    def validate_variants(self, value):
        if self.initial_data.get("metadata", {}).get(
            "include_gnomad_plof"
        ) or self.initial_data.get("metadata", {}).get(
            "include_clinvar_clinical_significance"
        ):
            if value:
                raise serializers.ValidationError(
                    "Variants can only be specified for a custom variant list."
                )

        if not value or not isinstance(value, list):
            raise serializers.ValidationError("A list of variants is required.")

        invalid_variants = []
        for variant in value:
            if "id" not in variant or not is_variant_id(variant["id"]):
                invalid_variants.append(variant)

        if invalid_variants:
            raise serializers.ValidationError(
                [f"'{variant}' is not a valid variant" for variant in invalid_variants]
            )

        num_unique_variants = len(set(variant["id"] for variant in value))
        if num_unique_variants != len(value):
            raise serializers.ValidationError("Variants must be unique.")

        max_num_variants = 5000
        if len(value) > max_num_variants:
            raise serializers.ValidationError(
                f"Variant lists may not contain more than {max_num_variants} variants"
            )

        return value

    class Meta:
        model = VariantList
        fields = ["uuid", "label", "notes", "type", "metadata", "variants"]
        read_only_fields = ["uuid"]


class VariantListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)
    status = ChoiceField(choices=VariantList.Status.choices, read_only=True)

    metadata = serializers.SerializerMethodField()

    access_permissions = VariantListAccessPermissionSerializer(
        many=True, read_only=True
    )

    def get_metadata(self, obj):  # pylint: disable=no-self-use
        metadata_version = obj.metadata.get("version", "1")
        metadata_serializer_class = {
            "1": VariantListV1MetadataSerializer,
            "2": VariantListV2MetadataSerializer,
        }[metadata_version]
        metadata_serializer = metadata_serializer_class(
            obj.metadata, context={"variant_list": obj}
        )
        data = metadata_serializer.data
        data.pop("version", None)
        return data

    def get_current_user(self):
        try:
            return self.context["request"].user
        except (KeyError, AttributeError):
            return None

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Whether or not access permissions are visible depends on the current user.
        # Access level should be visible if there is a current user.
        # All access permissions should only be visible if the current user is an owner of the variant list.
        current_user = self.get_current_user()
        if current_user:
            try:
                access = instance.access_permissions.get(user=current_user)
                data["access_level"] = access.get_level_display()
            except VariantListAccessPermission.DoesNotExist:
                pass

            if not current_user.has_perm(
                "calculator.view_variantlist_accesspermissions", instance
            ):
                data.pop("access_permissions")

            if not current_user.has_perm("calculator.view_variantlist_error", instance):
                data.pop("error")
        else:
            data.pop("access_permissions")
            data.pop("error")

        return data

    class Meta:
        model = VariantList

        fields = [
            "uuid",
            "label",
            "notes",
            "type",
            "metadata",
            "variants",
            "created_at",
            "updated_at",
            "status",
            "error",
            "access_permissions",
        ]

        read_only_fields = [f for f in fields if f not in ("label", "notes")]


class AddedVariantsSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    variants = serializers.ListField(child=serializers.CharField(), allow_empty=False)

    def validate_variants(self, value):
        invalid_variant_ids = [
            variant_id for variant_id in value if not is_variant_id(variant_id)
        ]
        if invalid_variant_ids:
            raise serializers.ValidationError(
                [
                    f"'{variant_id}' is not a valid variant ID"
                    for variant_id in invalid_variant_ids
                ]
            )

        num_unique_variants = len(set(value))
        if num_unique_variants != len(value):
            raise serializers.ValidationError("Variants must be unique.")

        existing_variant_ids = set(
            variant["id"] for variant in self.context["variant_list"].variants
        )

        duplicate_variant_ids = set(value) & existing_variant_ids
        if duplicate_variant_ids:
            raise serializers.ValidationError(
                [
                    f"'{variant_id}' is already present in this variant list"
                    for variant_id in duplicate_variant_ids
                ]
            )

        max_num_variants = 5000
        if len(set(value) | existing_variant_ids) > max_num_variants:
            raise serializers.ValidationError(
                f"Variant lists may not contain more than {max_num_variants} variants"
            )

        return value
