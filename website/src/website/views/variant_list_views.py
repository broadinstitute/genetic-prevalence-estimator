from django.conf import settings
from django.shortcuts import get_object_or_404

from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.filters import OrderingFilter
from rest_framework.generics import (
    GenericAPIView,
    ListAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import (
    DjangoObjectPermissions,
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from calculator.models import (
    VariantList,
    VariantListAccessPermission,
    VariantListAnnotation,
)
from calculator.serializers import (
    AddedVariantsSerializer,
    NewVariantListSerializer,
    VariantListSerializer,
    VariantListAnnotationSerializer,
    VariantListDashboardSerializer,
)
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
    lookup_field = "uuid"

    permission_classes = (IsAuthenticatedOrReadOnly,)

    serializer_class = VariantListSerializer

    def get_queryset(self):
        # gets require additional logic for un-authed or inactive users
        if self.request.method == "GET":
            # active staff can view any list
            if self.request.user.is_staff and self.request.user.is_active:
                return VariantList.objects.all()

            # anonymous users or inactive users can view all approved public lists
            public_lists = VariantList.objects.filter(
                public_status=VariantList.PublicStatus.APPROVED
            )
            if self.request.user.is_anonymous or not self.request.user.is_active:
                return public_lists

            # active, non-staff users can view all approved public lists and any list
            #   they have been added to
            collaborated_lists = VariantList.objects.filter(
                access_permission__user=self.request.user
            )
            combined_lists = collaborated_lists | public_lists
            return combined_lists.distinct()

        # if this view is used for any other request, let the object permissions
        #   handle the logic
        return VariantList.objects.all()

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.request.user.has_perm("calculator.change_variantlist", instance):
            raise PermissionDenied
        return self.update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.request.user.has_perm("calculator.change_variantlist", instance):
            raise PermissionDenied
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        instance = self.get_object()
        if not self.request.user.has_perm("calculator.delete_variantlist", instance):
            raise PermissionDenied
        return self.destroy(request, *args, **kwargs)


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


class VariantListVariantsViewObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
        "POST": ["%(app_label)s.change_%(model_name)s"],
    }


class VariantListVariantsView(GenericAPIView):
    queryset = VariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, VariantListVariantsViewObjectPermissions)

    serializer_class = AddedVariantsSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "variant_list": self.get_object()}

    def post(self, request, *args, **kwargs):  # pylint: disable=unused-argument
        variant_list = self.get_object()

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        added_variants = serializer.validated_data["variants"]

        if variant_list.status not in (
            VariantList.Status.READY,
            VariantList.Status.ERROR,
        ):
            raise ValidationError(
                f"Variants cannot be changed while variant list is {VariantList.Status(variant_list.status).label.lower()}"
            )

        variant_list.variants = [
            *variant_list.variants,
            *[{"id": variant_id} for variant_id in added_variants],
        ]

        variant_list.status = VariantList.Status.QUEUED
        variant_list.save()

        publisher.send_to_worker(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

        return Response({})


class VariantListAnnotationViewObjectPermissions(DjangoObjectPermissions):
    perms_map = {
        "GET": ["%(app_label)s.change_%(model_name)s"],
        "OPTIONS": ["%(app_label)s.change_%(model_name)s"],
        "HEAD": ["%(app_label)s.change_%(model_name)s"],
        "POST": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
    }


class VariantListAnnotationView(RetrieveUpdateAPIView):
    queryset = VariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, VariantListAnnotationViewObjectPermissions)

    serializer_class = VariantListAnnotationSerializer

    def get_object(self):
        variant_list = super().get_object()

        annotation, _ = VariantListAnnotation.objects.get_or_create(
            user=self.request.user,
            variant_list=variant_list,
        )

        return annotation


class PublicVariantListsView(ListAPIView):
    order_fields = ["updated_at"]
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get_queryset(self):
        if self.request.user.is_staff:
            return VariantList.objects.exclude(public_status="")
        return VariantList.objects.filter(
            public_status=VariantList.PublicStatus.APPROVED
        )

    def get_serializer_class(self):
        if self.request.user.is_staff:
            return VariantListSerializer
        return VariantListDashboardSerializer


class PublicVariantListView(RetrieveUpdateAPIView):
    queryset = VariantList.objects.all()

    serializer_class = VariantListSerializer

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated,)

    def perform_update(self, serializer):
        request_public_status = serializer.validated_data["public_status"]

        # don't allow submitting as public if an approved list for the gene exists
        if (
            VariantList.objects.exclude(uuid=serializer.instance.uuid)
            .filter(
                metadata__gene_id=serializer.instance.metadata["gene_id"],
                public_status=VariantList.PublicStatus.APPROVED,
            )
            .count()
            > 0
        ):
            raise PermissionDenied

        # if the user is a staff member, they can update a list to any public status
        if self.request.user.is_staff:
            serializer.save(
                public_status_updated_by=self.request.user,
                public_status=request_public_status,
            )
            return

        if not self.request.user.has_perm(
            "calculator.share_variantlist", serializer.instance
        ):
            raise PermissionDenied

        # if a user has edit permissions on the list, they are only allowed to submit the
        #   list as pending or make it private
        if request_public_status not in ["", "P"]:
            raise PermissionDenied

        serializer.save(
            public_status_updated_by=self.request.user,
            public_status=request_public_status,
        )
