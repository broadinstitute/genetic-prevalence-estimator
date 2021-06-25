from django.contrib.auth import get_user_model

from calculator.serializers.serializer import ModelSerializer


class CurrentUserSerializer(ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if not self.instance.is_staff:
            del self.fields["is_staff"]

    class Meta:
        model = get_user_model()

        fields = ["username", "is_active", "is_staff"]
        read_only_fields = list(fields)


class UserSerializer(ModelSerializer):
    class Meta:
        model = get_user_model()

        fields = ["id", "username", "is_active", "is_staff"]

        read_only_fields = [f for f in fields if f not in ("is_active", "is_staff")]


class NewUserSerializer(ModelSerializer):
    class Meta:
        model = get_user_model()

        fields = ["id", "username", "is_active", "is_staff"]

        read_only_fields = [
            f for f in fields if f not in ("username", "is_active", "is_staff")
        ]
