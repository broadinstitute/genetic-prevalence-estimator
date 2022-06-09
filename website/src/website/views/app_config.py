from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view()
def get_app_config(request):
    app_config = {
        "google_auth_client_id": settings.GOOGLE_AUTH_CLIENT_ID,
        "max_variant_lists_per_user": settings.MAX_VARIANT_LISTS_PER_USER,
    }
    return Response(app_config)
