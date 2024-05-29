import re

from rest_framework import serializers

from calculator.constants import GNOMAD_VERSIONS, GNOMAD_REFERENCE_GENOMES
from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField, UsernameField
from calculator.serializers.variant_list_access_permission_serializer import (
    VariantListAccessPermissionSerializer,
)


def is_gene_id(maybe_gene_id):
    return bool(re.fullmatch(r"ENSG\d{11}\.\d+", maybe_gene_id))


def is_transcript_id(maybe_transcript_id):
    return bool(re.fullmatch(r"ENST\d{11}\.\d+", maybe_transcript_id))


def is_variant_id(maybe_variant_id):
    return bool(re.fullmatch(r"(\d{1,2}|X|Y)-\d+-[ACGT]+-[ACGT]+", maybe_variant_id))


def is_structural_variant_id(maybe_structural_variant_id, gnomad_version):
    if gnomad_version not in ("4.1.0", "2.1.1"):
        raise ValueError(
            f"Version ${gnomad_version} does not have a known pattern for structural variant ids"
        )

    if gnomad_version == "4.1.0":
        pattern = r"^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)_CHR((1[0-9]|2[0-2]|[1-9])|X|Y)_([0-9a-f]*)$"
    elif gnomad_version == "2.1.1":
        pattern = r"^(BND|CPX|CTX|DEL|DUP|INS|INV|CNV)_((1[0-9]|2[0-2]|[1-9])|X|Y)_([0-9a-f]*)$"

    return bool(re.fullmatch(pattern, maybe_structural_variant_id, re.IGNORECASE))


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
    include_gnomad_missense_with_high_revel_score = serializers.BooleanField(
        required=False
    )
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
        if (
            attrs.get("include_gnomad_plof")
            or attrs.get("include_gnomad_missense_with_high_revel_score")
            or attrs.get("include_clinvar_clinical_significance")
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

    def get_reference_genome(self, obj):
        return GNOMAD_REFERENCE_GENOMES[obj["gnomad_version"]]

    def get_include_gnomad_plof(self, obj):  # pylint: disable=unused-argument
        return self.context["variant_list"].type == VariantList.Type.RECOMMENDED

    def get_include_clinvar_clinical_significance(self, obj):
        return obj.get("included_clinvar_variants", [])


class NewVariantListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)

    def validate_metadata(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        metadata_serializer = VariantListV2MetadataSerializer(data=value)
        if not metadata_serializer.is_valid():
            raise serializers.ValidationError(metadata_serializer.errors)

        return metadata_serializer.validated_data

    def validate_variants(self, value):
        if (
            self.initial_data.get("metadata", {}).get("include_gnomad_plof")
            or self.initial_data.get("metadata", {}).get(
                "include_gnomad_missense_with_high_revel"
            )
            or self.initial_data.get("metadata", {}).get(
                "include_clinvar_clinical_significance"
            )
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
        fields = [
            "uuid",
            "label",
            "notes",
            "type",
            "metadata",
            "variants",
            "structural_variants",
        ]
        read_only_fields = ["uuid"]


class VariantListSerializer(ModelSerializer):
    notes = serializers.CharField(allow_blank=True, required=False)
    status = ChoiceField(choices=VariantList.Status.choices, read_only=True)

    metadata = serializers.SerializerMethodField()

    access_permissions = VariantListAccessPermissionSerializer(
        many=True, read_only=True
    )

    representative_status = ChoiceField(
        choices=VariantList.RepresentativeStatus.choices
    )
    representative_status_updated_by = UsernameField()

    owners = serializers.SerializerMethodField()

    estimates = serializers.SerializerMethodField()

    def get_estimates(self, obj):
        shared_annotation = obj.annotations.filter(user__isnull=True).first()
        if shared_annotation:
            return {
                "genetic_prevalence": (
                    shared_annotation.variant_calculations.get("prevalence", "-")
                ),
                "carrier_frequency": (
                    shared_annotation.variant_calculations.get("carrierFrequency", "-")
                ),
            }
        return None

    def get_owners(self, obj):
        permissions = VariantListAccessPermission.objects.filter(
            variant_list=obj, level=VariantListAccessPermission.Level.OWNER
        )
        owners = [permission.user.username for permission in permissions]
        return owners

    def get_metadata(self, obj):
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
        if current_user and not current_user.is_anonymous:
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

        # Only show the owners array for approved representative lists
        if instance.representative_status != VariantList.RepresentativeStatus.APPROVED:
            data.pop("owners")

        return data

    class Meta:
        model = VariantList

        fields = [
            "uuid",
            "label",
            "notes",
            "supporting_document",
            "type",
            "metadata",
            "created_at",
            "updated_at",
            "status",
            "error",
            "access_permissions",
            "is_public",
            "representative_status",
            "representative_status_updated_by",
            "variants",
            "structural_variants",
            "estimates",
            "owners",
        ]

        read_only_fields = [
            f
            for f in fields
            if f
            not in (
                "label",
                "notes",
                "supporting_document",
                "is_public",
                "representative_status",
                "representative_status_updated_by",
            )
        ]


class AddedVariantsSerializer(
    serializers.Serializer
):  # pylint: disable=abstract-method
    variants = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    structural_variants = serializers.ListField(
        child=serializers.CharField(), allow_empty=True
    )

    def validate(self, attrs):

        attrs = super().validate(attrs)

        variants = attrs.get("variants", [])
        structural_variants = attrs.get("structural_variants", [])

        if not variants and not structural_variants:
            raise serializers.ValidationError(
                "At least one valid variant ID must be provided"
            )

        gnomad_version = self.context["variant_list"].metadata["gnomad_version"]

        invalid_variant_ids = [
            variant_id for variant_id in variants if not is_variant_id(variant_id)
        ]
        invalid_structural_variant_ids = [
            structural_variant_id
            for structural_variant_id in structural_variants
            if not is_structural_variant_id(structural_variant_id, gnomad_version)
        ]
        all_invalid_ids = invalid_variant_ids.append(invalid_structural_variant_ids)

        if all_invalid_ids:
            raise serializers.ValidationError(
                [
                    f"'{variant_id}' is not a valid variant ID"
                    for variant_id in all_invalid_ids
                ]
            )

        num_unique_variants = len(set(variants)) + len(set(structural_variants))
        if num_unique_variants != len(variants) + len(structural_variants):
            raise serializers.ValidationError("Variants must be unique.")

        existing_variant_ids = set(
            variant["id"] for variant in self.context["variant_list"].variants
        )
        existing_structural_variant_ids = set(
            structural_variant["id"]
            for structural_variant in self.context["variant_list"].structural_variants
        )

        combined_variant_set = set(variants) | set(structural_variants)
        combined_existing_variant_set = (
            existing_variant_ids | existing_structural_variant_ids
        )

        duplicate_variant_ids = combined_variant_set & combined_existing_variant_set
        if duplicate_variant_ids:
            raise serializers.ValidationError(
                [
                    f"'{variant_id}' is already present in this variant list"
                    for variant_id in duplicate_variant_ids
                ]
            )

        max_num_variants = 5000
        if len(combined_variant_set | combined_existing_variant_set) > max_num_variants:
            raise serializers.ValidationError(
                f"Variant lists may not contain more than {max_num_variants} variants"
            )

        return attrs


class VariantListDashboardSerializer(ModelSerializer):
    gene_symbol = serializers.CharField(source="metadata.gene_symbol", read_only=True)
    created_by = serializers.SlugRelatedField(slug_field="username", read_only=True)
    representative_status = ChoiceField(
        choices=VariantList.RepresentativeStatus.choices
    )
    representative_status_updated_by = serializers.SlugRelatedField(
        slug_field="username", read_only=True
    )

    class Meta:
        model = VariantList
        fields = [
            "uuid",
            "created_by",
            "gene_symbol",
            "label",
            "supporting_document",
            "is_public",
            "representative_status",
            "representative_status_updated_by",
            "metadata",
        ]
        read_only_fields = list(fields)
