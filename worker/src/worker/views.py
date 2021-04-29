import base64
import json
import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response


logger = logging.getLogger(__name__)


@api_view(["POST"])
def receive_message_view(request):
    if not request.data:
        raise ValidationError("No message received")

    if not isinstance(request.data, dict) or "message" not in request.data:
        raise ValidationError("Invalid message format")

    message = request.data["message"]

    payload = json.loads(base64.b64decode(message["data"]).decode("utf-8").strip())

    logger.info("Received message %s", payload)

    return Response(status=status.HTTP_204_NO_CONTENT)
