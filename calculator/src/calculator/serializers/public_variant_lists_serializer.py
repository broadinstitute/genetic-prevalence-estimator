from rest_framework import serializers

from django.contrib.auth import get_user_model

from calculator.models import VariantList, PublicVariantList
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField, UsernameField
from calculator.serializers.variant_list_serializer import (
    VariantListSerializer,
    is_variant_id,
)


class NewPublicVariantListSerializer(ModelSerializer):

    submitted_by = UsernameField()

    variant_list = serializers.SlugRelatedField(
        queryset=VariantList.objects.all(), slug_field="uuid"
    )

    approval_status = ChoiceField(
        choices=PublicVariantList.ApprovalStatus.choices, read_only=True
    )

    class Meta:
        model = PublicVariantList

        fields = [
            "uuid",
            "variant_list",
            "approval_status",
            "submitted_by",
            "submitted_at",
            "reviewed_by",
            "updated_at",
        ]

        read_only_fields = [
            f
            for f in fields
            if f
            not in ("approval_status", "submitted_at", "variant_list", "reviewed_by")
        ]


class PublicVariantListSerializer(ModelSerializer):

    approval_status = ChoiceField(choices=PublicVariantList.ApprovalStatus.choices)

    reviewed_by = UsernameField()

    submitted_by = serializers.SlugRelatedField(slug_field="username", read_only=True)

    variant_list = VariantListSerializer()

    class Meta:
        model = PublicVariantList

        fields = [
            "uuid",
            "variant_list",
            "approval_status",
            "submitted_by",
            "submitted_at",
            "reviewed_by",
            "updated_at",
        ]

        read_only_fields = [
            f
            for f in fields
            if f
            not in (
                "approval_status",
                "submitted_by",
                "submitted_at",
                "reviewed_by",
                "updated_at",
            )
        ]
