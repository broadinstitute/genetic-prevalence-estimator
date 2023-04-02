from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.renderers import TemplateHTMLRenderer
from rest_framework.response import Response
from rest_framework.views import APIView


class FrontendView(APIView):
    renderer_classes = [TemplateHTMLRenderer]
    template_name = "frontend/index.html"

    @method_decorator(ensure_csrf_cookie)
    def get(self, request, *args, **kwargs):  # pylint: disable=unused-argument
        return Response({})
