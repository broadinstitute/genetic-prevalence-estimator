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


logger = logging.getLogger(__name__)


def serialize_user(user):
    return {"username": user.username}


@api_view(["POST"])
@csrf_protect
def signin(request):
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
            username = idinfo["email"]

            user, _ = get_user_model().objects.get_or_create(username=username)
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            return Response(serialize_user(user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def signout(request):
    logout(request)
    return Response({})


@api_view()
@permission_classes([IsAuthenticated])
def whoami(request):
    return Response(serialize_user(request.user))
