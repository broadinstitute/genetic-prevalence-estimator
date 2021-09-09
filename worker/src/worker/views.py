import base64
import binascii
import json
import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .tasks import handle_event


logger = logging.getLogger(__name__)


@api_view(["POST"])
def receive_message_view(request):
    if not request.data:
        raise ValidationError("No message received")

    if not isinstance(request.data, dict) or "message" not in request.data:
        raise ValidationError("Invalid message format")

    message = request.data["message"]

    if not isinstance(message, dict) or "data" not in message:
        raise ValidationError("Invalid message format")

    try:
        payload = json.loads(
            base64.b64decode(message["data"], validate=True).decode("utf-8").strip()
        )
    except (binascii.Error, json.JSONDecodeError) as e:
        raise ValidationError("Invalid payload format") from e

    logger.info("Received message %s", payload)

    handle_event(payload)

    return Response(status=status.HTTP_204_NO_CONTENT)
