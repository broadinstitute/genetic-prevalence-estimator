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
    username = serializers.SerializerMethodField()

    def get_username(self, obj):  # pylint: disable=no-self-use
        return obj.user.username

    level = ChoiceField(choices=VariantListAccessPermission.Level.choices)

    class Meta:
        model = VariantListAccessPermission

        fields = ["uuid", "username", "level"]

        read_only_fields = [f for f in fields if f not in ("level",)]
