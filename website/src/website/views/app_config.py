from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view()
def get_app_config(request):
    app_config = {"google_auth_client_id": settings.GOOGLE_AUTH_CLIENT_ID}
    return Response(app_config)
