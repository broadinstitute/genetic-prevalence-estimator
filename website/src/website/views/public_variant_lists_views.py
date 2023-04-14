from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import DjangoObjectPermissions, isAuthenticated
from rest_framework.response import Response

from calculator.models import (
    VariantList,
    PublicVariantLists,
)

from website.permissions import ViewObjectPermissions
from website.pubsub import publisher


class PublicVariantListsView(ListCreateAPIView):
    def get_queryset(self):
        return VariantList.objects.filter(publication_status="Approved")

    ordering_fields = ["updated_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewPublicVariantListSerializer

        return PublicVariantListSerializer
