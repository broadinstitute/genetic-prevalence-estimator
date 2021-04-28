from django.urls import path
from django.views.generic import TemplateView


html = TemplateView.as_view(template_name="frontend/index.html")


urlpatterns = [*[path(p, html, name=name) for p, name in [("", "home")]]]


handler400 = "rest_framework.exceptions.bad_request"  # pylint: disable=invalid-name
handler500 = "rest_framework.exceptions.server_error"  # pylint: disable=invalid-name
