import csv
import json
from datetime import datetime

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter
from rest_framework.generics import (
    CreateAPIView,
    ListAPIView,
    RetrieveUpdateDestroyAPIView,
)
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
    IsAdminUser,
)
from rest_framework.response import Response

from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.gzip import gzip_page
from django.views.decorators.cache import cache_control

from calculator.models import (
    DashboardList,
    VariantList,
    DominantDashboardList,
)
from calculator.serializers import (
    NewDashboardListSerializer,
    DashboardListSerializer,
    DashboardListDashboardSerializer,
)

# set csv field size limit to half of a megabyte
csv.field_size_limit(512 * 1024)  # 512 KB in bytes

SIX_HOURS_IN_SECONDS = 6 * 60 * 60


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
                variant_calculations = json.loads(row[5])

                row_dict = {
                    "gene_id": row[0],
                    "label": row[1],
                    "notes": row[2],
                    "created_at": datetime.strptime(row[3], "%Y-%m-%dT%H:%M:%S.%f"),
                    "metadata": metadata,
                    "variant_calculations": variant_calculations,
                    "top_ten_variants": json.loads(row[6]),
                    "genetic_prevalence_orphanet": row[7],
                    "genetic_prevalence_genereviews": row[8],
                    "genetic_prevalence_other": row[9],
                    "genetic_incidence_other": row[10],
                    "inheritance_type": row[11],
                }

                if DashboardList.objects.filter(gene_id=gene_id).count() > 0:
                    instance = DashboardList.objects.filter(gene_id=gene_id).first()
                    row_dict.pop("gene_id")
                    serializer = DashboardListSerializer(instance, data=row_dict)
                else:
                    serializer = NewDashboardListSerializer(data=row_dict)

                if serializer.is_valid():
                    serializer.save()

                    dashboard_list = DashboardList.objects.get(gene_id=gene_id)

                    # check if there is an approved representative variant list for this
                    #   gene, if so set the foreign key relationship here. Check if only
                    #   ENSG and decimal is the same to match on different versions of
                    #   the gene (i.e. ENSG0001.1 == ENSG0001.3, but not ENSG000123.1)
                    gene_id = metadata["gene_id"].split(".")[0]
                    gene_id_with_decimal = f"{gene_id}."

                    representative_variant_list = None
                    representative_variant_list_with_same_gene_id = VariantList.objects.filter(
                        metadata__gene_id__startswith=gene_id_with_decimal,
                        representative_status=VariantList.RepresentativeStatus.APPROVED,
                    )
                    if representative_variant_list_with_same_gene_id.count() > 0:
                        representative_variant_list = (
                            representative_variant_list_with_same_gene_id[0]
                        )

                    dashboard_list = serializer.save(
                        representative_variant_list=representative_variant_list
                    )

                    dominant_dashboard_list = None
                    dominant_dashboard_list_with_same_gene_id = (
                        DominantDashboardList.objects.filter(
                            metadata__gene_id__startswith=gene_id_with_decimal,
                        )
                    )

                    if dominant_dashboard_list_with_same_gene_id.count() > 0:
                        dominant_dashboard_list = (
                            dominant_dashboard_list_with_same_gene_id[0]
                        )

                    dashboard_list = serializer.save(
                        dominant_dashboard_list=dominant_dashboard_list
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


@method_decorator(gzip_page, name="dispatch")
@method_decorator(
    cache_control(public=True, max_age=SIX_HOURS_IN_SECONDS), name="dispatch"
)
class DashboardListsView(ListAPIView):
    queryset = DashboardList.objects.all()
    permission_classes = (IsAuthenticatedOrReadOnly,)
    filter_backends = [OrderingFilter]
    ordering_fields = ["label", "created_at"]
    ordering = ["-created_at"]
    serializer_class = DashboardListDashboardSerializer

    def list(self, request, *args, **kwargs):
        CACHE_KEY = "dashboard_cache"

        if request.user.is_staff and request.query_params.get("refresh") == "true":
            cache.delete(CACHE_KEY)

        data = cache.get(CACHE_KEY)

        if data is None:
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            data = serializer.data
            cache.set(CACHE_KEY, data, timeout=SIX_HOURS_IN_SECONDS)

        return Response(data)


class DashboardListView(RetrieveUpdateDestroyAPIView):
    lookup_field = "gene_id"

    permission_classes = (IsAuthenticatedOrReadOnly,)

    serializer_class = DashboardListSerializer

    def get_queryset(self):
        return DashboardList.objects.all()

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        raise PermissionDenied

    def patch(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.destroy(request, *args, **kwargs)
