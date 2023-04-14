from rest_framework import serializers

from calculator.models import PublicVariantLists
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField, UsernameField
from calculator.serializers.variant_list_serializer import is_variant_id


class PublicVariantListSerializer(ModelSerializer):

    variant_list = serializers.SlugRelatedField(
        queryset=VariantList.objects.all(), slug_field="uuid"
    )

    approval_status = ChoiceField(choices=PublicVariantLists.ApprovalStatus.choices)

    class Meta:
        model = PublicVariantLists
        fields = ["uuid", "variant_list", "approval_status", "updated_by", "updated_at"]
        read_only_fields = [
            f
            for f in fields
            if f not in ("approval_status", "updated_by", "updated_at")
        ]


class NewPublicVariantListSerializer(ModelSerializer):
    class Meta:
        model = PublicVariantLists
        fields = ["uuid", "variant_list"]
        read_only_fields = list(fields)
