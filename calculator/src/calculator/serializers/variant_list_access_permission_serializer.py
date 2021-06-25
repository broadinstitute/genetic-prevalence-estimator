from rest_framework import serializers

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers.serializer_fields import ChoiceField, UsernameField


class NewVariantListAccessPermissionSerializer(serializers.ModelSerializer):
    user = UsernameField()

    variant_list = serializers.SlugRelatedField(
        queryset=VariantList.objects.all(), slug_field="uuid"
    )

    level = ChoiceField(choices=VariantListAccessPermission.Level.choices)

    def validate(self, attrs):
        unknown_fields = set(self.initial_data) - set(self.fields)
        if unknown_fields:
            raise serializers.ValidationError(
                f"Unknown fields: {', '.join(unknown_fields)}"
            )

        return attrs

    class Meta:
        model = VariantListAccessPermission

        fields = ["uuid", "user", "variant_list", "level"]

        read_only_fields = ["uuid"]


class VariantListAccessPermissionSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    def get_username(self, obj):  # pylint: disable=no-self-use
        return obj.user.username

    level = ChoiceField(choices=VariantListAccessPermission.Level.choices)

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
        model = VariantListAccessPermission

        fields = ["uuid", "username", "level"]

        read_only_fields = [f for f in fields if f not in ("level",)]
