from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import DjangoObjectPermissions, IsAuthenticated
from rest_framework.response import Response

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers import NewVariantListSerializer, VariantListSerializer
from website.permissions import ViewObjectPermissions
from website.pubsub import publisher


class VariantListsView(ListCreateAPIView):
    def get_queryset(self):
        return VariantList.objects.filter(access_permission__user=self.request.user)

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    filter_backends = [OrderingFilter]
    ordering_fields = ["label", "updated_at"]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewVariantListSerializer

        return VariantListSerializer

    def perform_create(self, serializer):
        if (
            self.request.user.created_variant_lists.count()
            >= settings.MAX_VARIANT_LISTS_PER_USER
        ):
            raise ValidationError(
                "You have created the maximum number of variant lists. Delete one to create another."
            )

        variant_list = serializer.save(created_by=self.request.user)
        VariantListAccessPermission.objects.create(
            variant_list=variant_list,
            user=self.request.user,
            level=VariantListAccessPermission.Level.OWNER,
        )

        publisher.send_to_worker(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
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


class VariantListProcessViewObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
        "POST": ["%(app_label)s.change_%(model_name)s"],
    }


class VariantListProcessView(GenericAPIView):
    queryset = VariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, VariantListProcessViewObjectPermissions)

    def post(self, request, *args, **kwargs):  # pylint: disable=unused-argument
        variant_list = self.get_object()

        publisher.send_to_worker(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

        variant_list.status = VariantList.Status.QUEUED
        variant_list.save()

        return Response({})
