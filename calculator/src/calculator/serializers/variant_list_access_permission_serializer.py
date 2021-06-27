from rest_framework import serializers

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers.serializer import ModelSerializer
from calculator.serializers.serializer_fields import ChoiceField, UsernameField


class NewVariantListAccessPermissionSerializer(ModelSerializer):
    user = UsernameField()

    variant_list = serializers.SlugRelatedField(
        queryset=VariantList.objects.all(), slug_field="uuid"
    )

    level = ChoiceField(choices=VariantListAccessPermission.Level.choices)

    class Meta:
        model = VariantListAccessPermission

        fields = ["uuid", "user", "variant_list", "level"]

        read_only_fields = ["uuid"]


class VariantListAccessPermissionSerializer(ModelSerializer):
    user = serializers.SlugRelatedField(slug_field="username", read_only=True)

    level = ChoiceField(choices=VariantListAccessPermission.Level.choices)

    class Meta:
        model = VariantListAccessPermission

        fields = ["uuid", "user", "level"]

        read_only_fields = [f for f in fields if f not in ("level",)]
