from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import CreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from calculator.models import VariantListAccessPermission
from calculator.serializers import (
    NewVariantListAccessPermissionSerializer,
    VariantListAccessPermissionSerializer,
)
from website.permissions import ViewObjectPermissions


class VariantListAccessList(CreateAPIView):
    queryset = VariantListAccessPermission.objects.all()

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    serializer_class = NewVariantListAccessPermissionSerializer

    def perform_create(self, serializer):
        if not self.request.user.has_perm(
            "calculator.share_variantlist", serializer.validated_data["variant_list"]
        ):
            raise PermissionDenied

        serializer.save(created_by=self.request.user)

    def get_success_headers(self, data):
        try:
            return {"Location": f"/api/variant-list-access/{data['uuid']}/"}
        except KeyError:
            return {}


class VariantListAccessDetail(RetrieveUpdateDestroyAPIView):
    queryset = VariantListAccessPermission.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    serializer_class = VariantListAccessPermissionSerializer

    def perform_update(self, serializer):
        serializer.save(last_updated_by=self.request.user)
