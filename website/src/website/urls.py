from django.urls import path
from django.views.generic import TemplateView

from website.views.app_config import get_app_config
from website.views.auth import signin, signout, whoami
from website.views.variant_lists import VariantListsView, VariantListView


html = TemplateView.as_view(template_name="frontend/index.html")


urlpatterns = [
    *[path(p, html, name=name) for p, name in [("", "home")]],
    path("api/config/", get_app_config, name="app_config"),
    path("api/auth/signin/", signin, name="signin"),
    path("api/auth/signout/", signout, name="signout"),
    path("api/auth/whoami/", whoami, name="whoami"),
    path("api/variant-lists/", VariantListsView.as_view(), name="variant-lists"),
    path(
        "api/variant-lists/<uuid:uuid>/", VariantListView.as_view(), name="variant-list"
    ),
]


handler400 = "rest_framework.exceptions.bad_request"  # pylint: disable=invalid-name
handler500 = "rest_framework.exceptions.server_error"  # pylint: disable=invalid-name
