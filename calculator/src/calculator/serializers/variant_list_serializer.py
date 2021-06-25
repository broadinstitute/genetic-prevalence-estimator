import re

from rest_framework import serializers

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers.serializer_fields import ChoiceField
from calculator.serializers.variant_list_access_permission_serializer import (
    VariantListAccessPermissionSerializer,
)


def is_gene_id(maybe_gene_id):
    return bool(re.fullmatch(r"ENSG\d{11}", maybe_gene_id))


def is_variant_id(maybe_variant_id):
    return bool(re.fullmatch(r"(\d{1,2}|X|Y)-\d+-[ACGT]+-[ACGT]+", maybe_variant_id))


class GnomadVariantListMetadataVersion1Serializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    gnomad_version = serializers.ChoiceField(["2", "3"])
    gene_id = serializers.CharField(max_length=15)
    filter_loftee = serializers.MultipleChoiceField(["HC", "LC"], allow_null=True)
    filter_clinvar_clinical_significance = serializers.MultipleChoiceField(
        ["pathogenic", "uncertain", "benign", "other"], allow_null=True
    )

    def validate_gene_id(self, value):  # pylint: disable=no-self-use
        if not is_gene_id(value):
            raise serializers.ValidationError(f"'{value}' is not a valid gene ID.")


class CustomVariantListMetadataVersion1Serializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    reference_genome = serializers.ChoiceField(["GRCh37", "GRCh38"])


class NewVariantListSerializer(serializers.ModelSerializer):
    description = serializers.CharField(allow_blank=True, required=False)

    def validate(self, attrs):
        unknown_fields = set(self.initial_data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError(
                f"Unknown fields: {', '.join(unknown_fields)}"
            )

        return attrs

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        variant_list_type = self.initial_data.get("type")
        version = value.pop("version")
        if variant_list_type == VariantList.Type.CUSTOM:
            metadata_serializer_class = {
                "1": CustomVariantListMetadataVersion1Serializer
            }.get(version)
        elif variant_list_type == VariantList.Type.GNOMAD:
            metadata_serializer_class = {
                "1": GnomadVariantListMetadataVersion1Serializer
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
            if not is_variant_id(variant):
                invalid_variants.append(variant)

        if invalid_variants:
            raise serializers.ValidationError(
                [
                    f"'{variant}' is not a valid variant ID"
                    for variant in invalid_variants
                ]
            )

        return value

    class Meta:
        model = VariantList
        fields = ["uuid", "label", "description", "type", "metadata", "variants"]
        read_only_fields = ["uuid"]


class VariantListSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Whether or not access permissions are visible depends on the current user.
        # Access level should be visible if there is a current user.
        # All access permissions should only be visible if the current user is an owner of the variant list.
        current_user = self.context.get("current_user")
        if not current_user:
            del self.fields["access_level"]
            del self.fields["access_permissions"]

        else:
            access = self.instance.access_permissions.get(user=current_user)
            if not access or access.level != VariantListAccessPermission.Level.OWNER:
                del self.fields["access_permissions"]

    status = ChoiceField(choices=VariantList.Status.choices, read_only=True)

    access_level = serializers.SerializerMethodField()

    def get_access_level(self, obj):
        try:
            current_user = self.context["current_user"]
            return obj.access_permissions.get(user=current_user).get_level_display()
        except KeyError:
            return None

    access_permissions = VariantListAccessPermissionSerializer(
        many=True, read_only=True
    )

    def validate(self, attrs):
        unknown_fields = set(self.initial_data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError(
                f"Unknown fields: {', '.join(unknown_fields)}"
            )

        read_only_fields = set(self.initial_data).intersection(
            set(
                field_name
                for field_name, field in self.fields.items()
                if field.read_only
            )
        )

        if read_only_fields:
            raise serializers.ValidationError(
                {
                    field_name: f"{field_name} cannot be updated."
                    for field_name in read_only_fields
                }
            )

        return attrs

    class Meta:
        model = VariantList

        fields = [
            "uuid",
            "label",
            "description",
            "type",
            "metadata",
            "variants",
            "created_at",
            "updated_at",
            "status",
            "access_level",
            "access_permissions",
        ]

        read_only_fields = [f for f in fields if f not in ("label", "description")]
