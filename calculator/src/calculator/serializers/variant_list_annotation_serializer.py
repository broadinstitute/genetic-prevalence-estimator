from rest_framework import serializers

from calculator.models import VariantListAnnotation
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.variant_list_serializer import (
    is_variant_id,
    is_structural_variant_id,
)


class VariantListAnnotationSerializer(ModelSerializer):
    def _get_variant_list_variant_ids(self):
        if not self.instance:
            return []

        variant_list = self.instance.variant_list
        return set(variant["id"] for variant in variant_list.variants)

    def _get_variant_list_structural_variant_ids(self):
        if not self.instance:
            return []

        variant_list = self.instance.variant_list
        return set(
            structural_variant["id"]
            for structural_variant in variant_list.structural_variants
        )

    def _get_gnomad_version(self):
        variant_list = self.instance.variant_list
        return variant_list.metadata["gnomad_version"]

    def is_valid_tag(self, tag):
        valid_tags = {"A", "B", "C", "D"}
        return tag in valid_tags

    def validate_selected_variants(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Selected variants must contain a list of variant IDs."
            )

        gnomad_version = self._get_gnomad_version()

        if not all(
            is_variant_id(id) or is_structural_variant_id(id, gnomad_version)
            for id in value
        ):
            raise serializers.ValidationError(
                "Selected variants must contain a list of variant IDs."
            )

        variant_list_variants = self._get_variant_list_variant_ids()
        variant_list_structural_variants = (
            self._get_variant_list_structural_variant_ids()
        )
        combined_variant_ids = variant_list_variants | variant_list_structural_variants
        if not all(variant_id in combined_variant_ids for variant_id in value):
            raise serializers.ValidationError(
                "Selected variants must contain only variants in variant list."
            )

        return value

    def validate_variant_notes(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Variant notes must contain a mapping of variant ID to notes."
            )
        if not all(is_variant_id(v) for v in value):
            raise serializers.ValidationError(
                "Variant notes must contain a mapping of variant ID to notes."
            )
        if not all(isinstance(v, str) for v in value.values()):
            raise serializers.ValidationError(
                "Variant notes must contain a mapping of variant ID to notes."
            )

        variant_list_variants = self._get_variant_list_variant_ids()
        if not all(variant_id in variant_list_variants for variant_id in value):
            raise serializers.ValidationError(
                "Variant notes must contain only variants in variant list."
            )

        return value

    def validate_tagged_groups(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Tagged groups must contain a mapping of group to variant IDs."
            )

        if not all(self.is_valid_tag(group) for group in value.keys()):
            raise serializers.ValidationError("Each group (tag) must be valid.")

        for variant_ids in value.values():
            print(variant_ids)
            if not isinstance(variant_ids, (dict, list, set)):
                print(type(value))
                raise serializers.ValidationError(
                    "Each group (tag) must map to a list or set of variant IDs."
                )

            if not all(is_variant_id(variant_id) for variant_id in variant_ids):
                raise serializers.ValidationError(
                    "Each group (tag) must map to valid variant IDs."
                )

        return value

    class Meta:
        model = VariantListAnnotation

        fields = [
            "selected_variants",
            "tagged_groups",
            "variant_notes",
            "include_homozygotes_in_calculations",
            "variant_calculations",
        ]
