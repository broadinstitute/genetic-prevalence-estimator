import re

from rest_framework import serializers

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


class RecommendedVariantListMetadataVersion1Serializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    gnomad_version = serializers.ChoiceField(["2.1.1", "3.1.2"])
    gene_id = serializers.CharField(max_length=20)
    transcript_id = serializers.CharField(max_length=20)
    included_clinvar_variants = serializers.MultipleChoiceField(
        [
            "pathogenic_or_likely_pathogenic",
            "conflicting_interpretations",
            "uncertain_significance",
            "benign_or_likely_benign",
            "other",
        ],
        allow_null=True,
    )
    clinvar_version = serializers.CharField(max_length=10, read_only=True)

    def validate_gene_id(self, value):  # pylint: disable=no-self-use
        if not is_gene_id(value):
            raise serializers.ValidationError(f"'{value}' is not a valid gene ID.")

    def validate_transcript_id(self, value):  # pylint: disable=no-self-use
        if not is_transcript_id(value):
            raise serializers.ValidationError(
                f"'{value}' is not a valid transcript ID."
            )


class CustomVariantListMetadataVersion1Serializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    reference_genome = serializers.ChoiceField(["GRCh37", "GRCh38"])
    gnomad_version = serializers.ChoiceField(["2.1.1", "3.1.2"])

    def validate(self, attrs):
        gnomad_reference_genome = {
            "2.1.1": "GRCh37",
            "3.1.2": "GRCh38",
        }[attrs["gnomad_version"]]

        if attrs["reference_genome"] != gnomad_reference_genome:
            raise serializers.ValidationError(
                f"Unable to use gnomAD v{attrs['gnomad_version']} with variants based on {attrs['reference_genome']}"
            )

        return attrs


class NewVariantListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        variant_list_type = self.initial_data.get("type")
        version = value.pop("version")
        if variant_list_type == VariantList.Type.CUSTOM:
            metadata_serializer_class = {
                "1": CustomVariantListMetadataVersion1Serializer
            }.get(version)
        elif variant_list_type == VariantList.Type.RECOMMENDED:
            metadata_serializer_class = {
                "1": RecommendedVariantListMetadataVersion1Serializer
            }.get(version)
        else:
            raise serializers.ValidationError(
                "Unknown variant list type, unable to validate metadata."
            )

        if not metadata_serializer_class:
            raise serializers.ValidationError("Invalid version.")

        metadata_serializer = metadata_serializer_class(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return value

    def validate_variants(self, value):
        if self.initial_data.get("type") != VariantList.Type.CUSTOM:
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
    status = ChoiceField(choices=VariantList.Status.choices, read_only=True)

    access_permissions = VariantListAccessPermissionSerializer(
        many=True, read_only=True
    )

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
