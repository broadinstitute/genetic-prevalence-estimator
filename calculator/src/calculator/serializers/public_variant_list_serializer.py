from rest_framework import serializers

from calculator.models import VariantList, PublicVariantList
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField, UsernameField


class NewPublicVariantListSerializer(ModelSerializer):
    submitted_by = UsernameField()

    variant_list = serializers.SlugRelatedField(
        queryset=VariantList.objects.all(), slug_field="uuid"
    )

    approval_status = ChoiceField(
        choices=PublicVariantList.PublicStatus.choices, read_only=True
    )

    class Meta:
        model = PublicVariantList

        fields = [
            "variant_list",
            "approval_status",
            "submitted_by",
            "submitted_at",
            "reviewed_by",
            "reviewed_at",
        ]

        read_only_fields = [
            f for f in fields if f not in ("submitted_by", "variant_list")
        ]


class PublicVariantListSerializer(ModelSerializer):
    variant_list_uuid = serializers.CharField(source="variant_list.uuid")
    variant_list_gene_symbol = serializers.CharField(
        source="variant_list.metadata.gene_symbol"
    )
    variant_list_label = serializers.CharField(source="variant_list.label")
    public_status = ChoiceField(choices=PublicVariantList.PublicStatus.choices)
    submitted_by = UsernameField()
    reviewed_by = UsernameField()

    class Meta:
        model = PublicVariantList
        fields = [
            "variant_list",
            "variant_list_uuid",
            "variant_list_gene_symbol",
            "variant_list_label",
            "submitted_by",
            "submitted_at",
            "public_status",
            "reviewed_by",
            "reviewed_at",
        ]
        read_only_fields = ["variant_list", "submitted_by", "submitted_at"]


class PublicVariantListReducedSerializer(ModelSerializer):
    variant_list_uuid = serializers.CharField(source="variant_list.uuid")
    variant_list_gene_symbol = serializers.CharField(
        source="variant_list.metadata.gene_symbol"
    )
    variant_list_label = serializers.CharField(source="variant_list.label")
    submitted_by = UsernameField()

    class Meta:
        model = PublicVariantList
        fields = [
            "variant_list_uuid",
            "variant_list_gene_symbol",
            "variant_list_label",
            "submitted_by",
        ]
        read_only_fields = list(fields)
