import os
import requests
from requests.exceptions import RequestException
from django.conf import settings
from django.db.models import Q
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError as DjangoCoreValidationError

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
    DashboardList,
)
from calculator.serializers import (
    AddedVariantsSerializer,
    NewVariantListSerializer,
    VariantListSerializer,
    VariantListAnnotationSerializer,
    VariantListDashboardSerializer,
    is_variant_id,
    is_structural_variant_id,
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

    def check_list_limit(self, user):
        if not user.is_staff and user.created_variant_lists.count() >= settings.MAX_VARIANT_LISTS_PER_USER:
            raise ValidationError(
                "You have created the maximum number of variant lists. Delete one to create another."
            )

    def perform_create(self, serializer):
        self.check_list_limit(self.request.user)

        variants = serializer.validated_data.get("variants", [])
        for variant in variants:
            if not is_variant_id(variant["id"]):
                raise ValidationError(
                    f"All short variants must be of a valid ID, malformed ID: {variant['id']}"
                )

        structural_variants = serializer.validated_data.get("structural_variants", [])
        for structural_variant in structural_variants:
            if not is_structural_variant_id(
                structural_variant["id"],
                serializer.validated_data["metadata"]["gnomad_version"],
            ):
                raise ValidationError(
                    f"All structural variants must be of a valid ID, malformed ID: {structural_variant['id']}"
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

            # anonymous users or inactive users can view all public lists and
            #   approved representative lists
            public_lists = VariantList.objects.filter(
                Q(is_public=True)
                | Q(representative_status=VariantList.RepresentativeStatus.APPROVED)
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
        previous_publicity_status = instance.is_public

        if (
            not self.request.user.has_perm("calculator.change_variantlist", instance)
            or "representative_status" in request.data
        ):
            raise PermissionDenied

        supporting_documents = request.data.get("supporting_documents", "")
        if supporting_documents:
            url_validator = URLValidator()
            try:
                url_validator(supporting_documents[0]["url"])
            except DjangoCoreValidationError as exc:
                raise ValidationError(
                    "The supporting document must have a valid URL"
                ) from exc

        current_publicity_status = request.data.get("is_public")
        if current_publicity_status is True and previous_publicity_status is False:
            self.send_slack_notification(instance.label, self.request.user)

        return self.partial_update(request, *args, **kwargs)

    def send_slack_notification(self, label, user):
        webhook_url = os.getenv("SLACK_WEBHOOK_URL")
        if not webhook_url:
            raise RuntimeError("Slack Webhook URL is not configured in settings.")

        message = {
            "attachments": [
                {
                    "pretext": f"Approval needed for public status of the list '{label}' submitted by user {user}.",
                }
            ]
        }

        print(f"Slack message: {message}")

        try:
            response = requests.post(webhook_url, json=message, timeout=5)
            response.raise_for_status()
            print("Slack notification sent successfully.")
        except RequestException as e:
            print(f"Failed to send Slack notification. Error: {e}")

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

    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):  # pylint: disable=unused-argument
        instance = self.get_object()
        if not self.request.user.is_staff and not self.request.user.has_perm(
            "calculator.change_variantlist", instance
        ):
            raise PermissionDenied

        variant_list = self.get_object()

        publisher.send_to_worker(
            {"type": "process_variant_list", "args": {"uuid": str(variant_list.uuid)}}
        )

        variant_list.status = VariantList.Status.QUEUED
        if variant_list.metadata["gnomad_version"] == "4.0.0":
            variant_list.metadata["gnomad_version"] = "4.1.0"
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
        for variant in added_variants:
            if not is_variant_id(variant):
                raise ValidationError(
                    f"All short variants must be of a valid ID, malformed ID: {variant}"
                )

        added_structural_variants = serializer.validated_data.get(
            "structural_variants", []
        )
        if len(added_structural_variants) > 0 and variant_list.metadata[
            "gnomad_version"
        ] not in ("2.1.1", "4.1.0"):
            raise ValidationError(
                f"gnomAD version {variant_list.metadata['gnomad_version']} does not support Structural Variants"
            )
        for structural_variant in added_structural_variants:
            if not is_structural_variant_id(
                structural_variant, variant_list.metadata["gnomad_version"]
            ):
                raise ValidationError(
                    f"All structural variants must have a valid ID, malformed ID: {structural_variant}",
                )

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

        variant_list.structural_variants = [
            *variant_list.structural_variants,
            *[
                {"id": structural_variant_id}
                for structural_variant_id in added_structural_variants
            ],
        ]

        variant_list.status = VariantList.Status.QUEUED
        if variant_list.metadata["gnomad_version"] == "4.0.0":
            variant_list.metadata["gnomad_version"] = "4.1.0"
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


class VariantListSharedAnnotationView(RetrieveUpdateAPIView):
    queryset = VariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticatedOrReadOnly,)

    serializer_class = VariantListAnnotationSerializer

    def get_object(self):
        variant_list = super().get_object()

        annotation, _ = VariantListAnnotation.objects.get_or_create(
            user=None,
            variant_list=variant_list,
        )

        return annotation

    def perform_update(self, serializer):
        variant_list = super().get_object()

        if not (
            self.request.user.is_staff and self.request.user.is_active
        ) and not self.request.user.has_perm(
            "calculator.change_variantlist", variant_list
        ):
            raise PermissionDenied

        serializer.save()


class PublicVariantListsView(ListAPIView):
    order_fields = ["updated_at"]
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get_queryset(self):
        if self.request.user.is_staff:
            return VariantList.objects.filter(
                Q(is_public=True) | ~Q(representative_status="")
            )
        return VariantList.objects.filter(
            Q(is_public=True)
            | Q(representative_status=VariantList.RepresentativeStatus.APPROVED)
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
        request_representative_status = serializer.validated_data[
            "representative_status"
        ]

        variant_list_gene_id = (
            f"{serializer.instance.metadata['gene_id'].split('.')[0]}."
        )

        # if the user is a staff member, they can update a list to any public status
        if self.request.user.is_staff and self.request.user.is_active:
            serializer.save(
                representative_status_updated_by=self.request.user,
                representative_status=request_representative_status,
            )

            # when a staff member approves the list, if there is a dashboard list for
            #   this gene_id, set the foreign key of that dashboard list to this variant
            #   list, as this is now the representative variant list
            if (
                request_representative_status
                == VariantList.RepresentativeStatus.APPROVED
            ):
                dashboard_lists_with_same_gene_id = DashboardList.objects.filter(
                    metadata__gene_id__startswith=variant_list_gene_id
                )
                if dashboard_lists_with_same_gene_id.count() > 0:
                    dashboard_list = dashboard_lists_with_same_gene_id[0]
                    dashboard_list.representative_variant_list = serializer.instance
                    dashboard_list.save()

            # pylint: disable=fixme
            # TODO: if its anything but that, you should remove it as the list

            return

        if not self.request.user.has_perm(
            "calculator.share_variantlist", serializer.instance
        ):
            raise PermissionDenied

        # if a user has edit permissions on the list, they are only allowed to submit the
        #   list as pending or make it private
        if request_representative_status not in ["", "P"]:
            raise PermissionDenied

        # If a user with correct permissions submits
        if (
            VariantList.objects.exclude(uuid=serializer.instance.uuid)
            .filter(
                metadata__gene_id__startswith=variant_list_gene_id,
                representative_status=VariantList.RepresentativeStatus.APPROVED,
            )
            .count()
            > 0
        ):
            raise ValidationError(
                "An approved public list for this gene already exists!"
            )

        serializer.save(
            representative_status_updated_by=self.request.user,
            representative_status=request_representative_status,
        )
