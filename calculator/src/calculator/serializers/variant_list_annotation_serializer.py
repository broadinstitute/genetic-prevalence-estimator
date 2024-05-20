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

    def validate_selected_variants(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Selected variants must contain a list of variant IDs."
            )

        if not all(is_variant_id(id) or is_structural_variant_id(id) for id in value):
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

    class Meta:
        model = VariantListAnnotation

        fields = [
            "selected_variants",
            "variant_notes",
            "variant_calculations",
        ]
