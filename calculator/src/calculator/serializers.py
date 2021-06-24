import re

from rest_framework import serializers

from calculator.models import VariantList


def is_gene_id(maybe_gene_id):
    return bool(re.fullmatch(r"ENSG\d{11}", maybe_gene_id))


def is_variant_id(maybe_variant_id):
    return bool(re.fullmatch(r"(\d{1,2}|X|Y)-\d+-[ACGT]+-[ACGT]+", maybe_variant_id))


class GnomadVariantListDefinitionVersion1Serializer(
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


class CustomVariantListDefinitionVersion1Serializer(
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

    def validate_definition(self, value):
        if not value:
            raise serializers.ValidationError("This field is required.")

        variant_list_type = self.initial_data.get("type")
        version = value.pop("version")
        if variant_list_type == VariantList.Type.CUSTOM:
            definition_serializer_class = {
                "1": CustomVariantListDefinitionVersion1Serializer
            }.get(version)
        elif variant_list_type == VariantList.Type.GNOMAD:
            definition_serializer_class = {
                "1": GnomadVariantListDefinitionVersion1Serializer
            }.get(version)
        else:
            raise serializers.ValidationError(
                "Unknown variant list type, unable to validate definition."
            )

        if not definition_serializer_class:
            raise serializers.ValidationError("Invalid version.")

        definition_serializer = definition_serializer_class(data=value)
        if not definition_serializer.is_valid():
            raise serializers.ValidationError(definition_serializer.errors)

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
        fields = ["label", "description", "type", "definition", "variants"]


class VariantListSerializer(serializers.ModelSerializer):
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
            "definition",
            "variants",
            "created_at",
            "updated_at",
            "state",
        ]

        read_only_fields = [f for f in fields if f not in ("label", "description")]
