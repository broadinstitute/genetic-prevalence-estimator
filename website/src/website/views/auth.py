import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.views.decorators.csrf import csrf_protect
from google.oauth2 import id_token
from google.auth.transport import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from website.serializers import CurrentUserSerializer


logger = logging.getLogger(__name__)


def get_username_from_token(request):
    try:
        google_token = request.data["token"]
    except KeyError as err:
        raise ValidationError("Token required") from err
    else:
        try:
            idinfo = id_token.verify_oauth2_token(
                google_token, requests.Request(), settings.GOOGLE_AUTH_CLIENT_ID
            )
        except ValueError as err:
            raise ValidationError("Invalid token") from err
        else:
            return idinfo["email"]


@api_view(["POST"])
@csrf_protect
def signin(request):
    username = get_username_from_token(request)

    user, _ = get_user_model().objects.get_or_create(
        username=username, defaults={"is_active": False}
    )
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    serializer = CurrentUserSerializer(user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def signout(request):
    logout(request)
    return Response({})


@api_view()
@permission_classes([IsAuthenticated])
def whoami(request):
    serializer = CurrentUserSerializer(request.user)
    return Response(serializer.data)
