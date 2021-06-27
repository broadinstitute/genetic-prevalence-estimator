from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers import NewVariantListSerializer, VariantListSerializer
from website.permissions import ViewObjectPermissions


class VariantListsView(ListCreateAPIView):
    def get_queryset(self):
        return VariantList.objects.filter(access_permission__user=self.request.user)

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewVariantListSerializer

        return VariantListSerializer

    def perform_create(self, serializer):
        variant_list = serializer.save(created_by=self.request.user)
        VariantListAccessPermission.objects.create(
            variant_list=variant_list,
            user=self.request.user,
            level=VariantListAccessPermission.Level.OWNER,
        )

    def get_success_headers(self, data):
        try:
            return {"Location": f"/api/variant-lists/{data['uuid']}/"}
        except KeyError:
            return {}


class VariantListView(RetrieveUpdateDestroyAPIView):
    queryset = VariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    serializer_class = VariantListSerializer
