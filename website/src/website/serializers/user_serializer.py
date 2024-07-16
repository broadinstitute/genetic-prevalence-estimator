from django.contrib.auth import get_user_model

from calculator.serializers.serializer import ModelSerializer


class CurrentUserSerializer(ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not instance.is_staff:
            data.pop("is_staff")

        return data

    class Meta:
        model = get_user_model()

        fields = ["username", "is_active", "is_staff"]
        read_only_fields = list(fields)


class UserSerializer(ModelSerializer):
    class Meta:
        model = get_user_model()

        fields = ["id", "username", "is_active", "is_staff", "date_joined"]

        read_only_fields = [
            f for f in fields if f not in ("is_active", "is_staff", "date_joined")
        ]


class NewUserSerializer(ModelSerializer):
    class Meta:
        model = get_user_model()

        fields = ["id", "username", "is_active", "is_staff"]

        read_only_fields = [
            f for f in fields if f not in ("username", "is_active", "is_staff")
        ]
