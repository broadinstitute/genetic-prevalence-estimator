from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter
from rest_framework.generics import (
    CreateAPIView,
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    IsAdminUser,
)
import csv

from rest_framework import status
from rest_framework.response import Response

from google.cloud import storage

# TODO: remove me!
import logging

from calculator.models import (
    DashboardList,
    VariantList,
)
from calculator.serializers import (
    NewDashboardListSerializer,
    DashboardListSerializer,
)
from website.pubsub import publisher


logger = logging.getLogger(__name__)


class DashboardListsLoadView(CreateAPIView):

    permission_classes = (IsAuthenticated, IsAdminUser)

    def post(self, request):
        logger.info("Got post request")

        bucket_name = "aggregate-frequency-calculator-data"

        blob_name = "dashboard-lists.csv"

        client = storage.Client()

        logger.info("trying to read bucket...")
        try:
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            csv_data = blob.download_as_string().decode("utf-8").splitlines()

            logger.info("trying to read csv...")
            csv_reader = csv.DictReader(csv_data)

            for row in csv_reader:
                logger.info("reading another row:")
                logger.info(row)
                gene_id = row.get("gene_id")

                if DashboardList.objects.filter(gene_id=gene_id).count() > 0:
                    instance = DashboardList.objects.filter(gene_id=gene_id).first()
                    serializer = DashboardListSerializer(instance, data=row)
                else:
                    serializer = NewDashboardListSerializer(data=row)

                if serializer.is_valid():
                    serializer.save()
                else:
                    return Response(
                        serializer.errors, status=status.HTTP_400_BAD_REQUEST
                    )

            return Response(
                {"message": "Objects created/updated successfully"},
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardListsView(ListCreateAPIView):
    def get_queryset(self):
        return DashboardList.objects.all()

    permission_classes = (IsAuthenticated,)

    filter_backends = [OrderingFilter]
    ordering_fields = ["label", "updated_at"]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewDashboardListSerializer

        return DashboardListSerializer

    def perform_create(self, serializer):
        if not self.request.user.is_staff:
            raise PermissionDenied

        # If an approved public variant list already exists when this dashboard list is created
        #   assign that list as the dashboard entries associated public list
        public_variant_list = None
        public_variant_list_with_same_gene_id = VariantList.objects.filter(
            metadata__gene_id=self.request.data["metadata"]["gene_id"],
            public_status=VariantList.PublicStatus.APPROVED,
        )
        if public_variant_list_with_same_gene_id.count() > 0:
            public_variant_list = public_variant_list_with_same_gene_id[0]

        dashboard_list = serializer.save(public_variant_list=public_variant_list)

        publisher.send_to_worker(
            {
                "type": "process_dashboard_list",
                "args": {"uuid": str(dashboard_list.uuid)},
            }
        )

    def get_success_headers(self, data):
        try:
            return {"Location": f"/api/dashboard-lists/{data['uuid']}/"}
        except KeyError:
            return {}


class DashboardListView(RetrieveUpdateDestroyAPIView):
    lookup_field = "uuid"

    permission_classes = (IsAuthenticatedOrReadOnly,)

    serializer_class = DashboardListSerializer

    def get_queryset(self):
        return DashboardList.objects.all()

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.destroy(request, *args, **kwargs)
