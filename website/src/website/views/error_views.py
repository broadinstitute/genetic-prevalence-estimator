from rest_framework.response import Response
from rest_framework.status import HTTP_403_FORBIDDEN


def csrf_failure(request, reason=""):  # pylint: disable=unused-argument
    return Response({"detail": "CSRF verification failed."}, status=HTTP_403_FORBIDDEN)
