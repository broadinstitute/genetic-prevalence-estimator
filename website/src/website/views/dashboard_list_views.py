import csv
import json
from datetime import datetime

from rest_framework import status
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
from rest_framework.response import Response

from calculator.models import (
    DashboardList,
    VariantList,
)
from calculator.serializers import (
    NewDashboardListSerializer,
    DashboardListSerializer,
    DashboardListDashboardSerializer,
)
from website.pubsub import publisher


# set csv field size limit to half of a megabyte
csv.field_size_limit(512 * 1024)  # 512 KB in bytes


class DashboardListsLoadView(CreateAPIView):

    permission_classes = (IsAuthenticated, IsAdminUser)

    def post(self, request, *args, **kwargs):  # pylint: disable=unused-argument

        csv_file = request.FILES.get("csv_file")

        if not csv_file:
            return Response(
                {"error": "No CSV File provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decoded_file = csv_file.read().decode("utf-8").splitlines()
            reader = csv.reader(decoded_file)
            next(reader)  # ignore the header row

            for row in reader:

                gene_id = row[0]

                metadata = json.loads(row[4])

                row_dict = {
                    "gene_id": row[0],
                    "label": row[1],
                    "notes": row[2],
                    "created_at": datetime.strptime(row[3], "%Y-%m-%dT%H:%M:%S.%f"),
                    "metadata": metadata,
                    "total_allele_frequency": json.loads(row[5]),
                    "carrier_frequency": json.loads(row[6]),
                    "genetic_prevalence": json.loads(row[7]),
                    "top_ten_variants": json.loads(row[8]),
                    "genetic_prevalence_orphanet": row[9],
                    "genetic_prevalence_genereviews": row[10],
                    "genetic_prevalence_other": row[11],
                    "genetic_incidence_other": row[12],
                }

                if DashboardList.objects.filter(gene_id=gene_id).count() > 0:
                    instance = DashboardList.objects.filter(gene_id=gene_id).first()
                    row_dict.pop("gene_id")

                    # pylint: disable=fixme
                    # TODO: cannot update metadata, due to serializer method
                    #  fields, popping it for now but find a workaround?
                    row_dict.pop("metadata")
                    serializer = DashboardListSerializer(instance, data=row_dict)
                else:
                    serializer = NewDashboardListSerializer(data=row_dict)

                if serializer.is_valid():
                    serializer.save()

                    dashboard_list = DashboardList.objects.get(gene_id=gene_id)

                    # check if there is an approved representative variant list for
                    #   this gene, if so set the foreign key relationship here
                    representative_variant_list = None
                    representative_variant_list_with_same_gene_id = (
                        VariantList.objects.filter(
                            metadata__gene_id=metadata["gene_id"],
                            public_status=VariantList.PublicStatus.APPROVED,
                        )
                    )
                    if representative_variant_list_with_same_gene_id.count() > 0:
                        representative_variant_list = (
                            representative_variant_list_with_same_gene_id[0]
                        )

                    dashboard_list = serializer.save(
                        public_variant_list=representative_variant_list
                    )

                    # pylint: disable=fixme
                    # TODO: this is kind of jank
                    # manually set status to ready, as it does not need to process
                    dashboard_list.status = VariantList.Status.READY
                    dashboard_list.save()

                else:
                    return Response(
                        serializer.errors, status=status.HTTP_400_BAD_REQUEST
                    )

            return Response({"message": "CSV file processed succesfully"})

        # pylint: disable=broad-exception-caught
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardListsView(ListCreateAPIView):
    def get_queryset(self):
        return DashboardList.objects.all()

    permission_classes = (IsAuthenticated,)

    filter_backends = [OrderingFilter]
    ordering_fields = ["label", "created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        # if self.request.method == "POST":
        #     return NewDashboardListSerializer
        # return DashboardListSerializer
        return DashboardListDashboardSerializer

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
    lookup_field = "gene_id"

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
