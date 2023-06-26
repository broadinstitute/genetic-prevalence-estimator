from django.shortcuts import get_object_or_404

from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)

from calculator.models import (
    PublicVariantList,
)
from calculator.serializers import (
    NewPublicVariantListSerializer,
    PublicVariantListSerializer,
    PublicVariantListReducedSerializer,
)


class PublicVariantListsView(ListCreateAPIView):
    order_fields = ["reviewed_at"]
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get_queryset(self):
        if self.request.user.is_staff:
            return PublicVariantList.objects.all()
        else:
            return PublicVariantList.objects.filter(
                public_status=PublicVariantList.PublicStatus.APPROVED
            )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewPublicVariantListSerializer
        if self.request.user.is_staff:
            return PublicVariantListSerializer
        return PublicVariantListReducedSerializer

    def perform_create(self, serializer):
        if not self.request.user.has_perm(
            "calculator.share_variantlist", serializer.validated_data["variant_list"]
        ):
            raise PermissionDenied

        serializer.save(submitted_by=self.request.user)

    def get_success_headers(self, data):
        created_public_list = get_object_or_404(
            PublicVariantList, variant_list__uuid=data["variant_list"]
        )
        try:
            return {
                "Location": f"/api/public-variant-list/{created_public_list.variant_list.id}/"
            }
        except KeyError:
            return {}


class PublicVariantListDetail(RetrieveUpdateDestroyAPIView):
    queryset = PublicVariantList.objects.all()

    serializer_class = PublicVariantListSerializer

    lookup_field = "variant_list"

    permission_classes = (IsAuthenticated,)

    def perform_destroy(self, instance):
        if not self.request.user.is_staff and not self.request.user.has_perm(
            "calculator.share_variantlist", instance.variant_list
        ):
            raise PermissionDenied

        instance.delete()

    def perform_update(self, serializer):
        if not self.request.user.is_staff:
            raise PermissionDenied
        serializer.save()
