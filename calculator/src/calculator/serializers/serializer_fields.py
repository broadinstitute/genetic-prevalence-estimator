from django.contrib.auth import get_user_model
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.validators import MaxLengthValidator
from rest_framework import serializers


class ChoiceField(serializers.ChoiceField):
    """Choice field that serializes the choice's label and accepts either a choice's value or its label."""

    def to_representation(self, value):
        if value in ("", None):
            return value

        return self.choices[value]

    def to_internal_value(self, data):
        if data == "" and self.allow_blank:
            return ""

        for key, val in self.choices.items():
            if str(data) in (str(key), str(val)):
                return key

        return self.fail("invalid_choice", input=data)


class UsernameField(serializers.RelatedField):
    default_error_messages = {"invalid": "Invalid username."}

    queryset = get_user_model().objects.all()

    def to_representation(self, value):
        return value.username

    def to_internal_value(self, data):
        if not isinstance(data, str):
            return self.fail("invalid")

        for validator in [
            UnicodeUsernameValidator(),
            MaxLengthValidator(
                150, "Ensure this field has no more than 150 characters."
            ),
        ]:
            validator(data)

        try:
            user, _ = self.get_queryset().get_or_create(username=data)
            return user
        except (TypeError, ValueError):
            return self.fail("invalid")
