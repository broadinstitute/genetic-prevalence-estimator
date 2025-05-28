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
    IsAdminUser,
)
from rest_framework.response import Response

from calculator.models import (
    DominantDashboardList,
    DashboardList,
    VariantList,
)
from calculator.serializers import (
    NewDominantDashboardListSerializer,
    DominantDashboardListSerializer,
    DominantDashboardListDashboardSerializer,
)

from calculator.serializers import (
    NewDashboardListSerializer,
)

# set csv field size limit to half of a megabyte
csv.field_size_limit(512 * 1024)  # 512 KB in bytes


class DominantDashboardListsLoadView(CreateAPIView):
    permission_classes = (IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        return NewDominantDashboardListSerializer

    def post(self, request, *args, **kwargs):  # pylint: disable=unused-argument
        csv_file = request.FILES.get("csv_file")

        if not csv_file:
            return Response(
                {"error": "No CSV File provided"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            decoded_file = csv_file.read().decode("utf-8").splitlines()
            reader = csv.reader(decoded_file)
            next(reader)

            for row in reader:
                gene_id = row[0]

                metadata = json.loads(row[2])
                de_novo_variant_calculations = json.loads(row[3])

                row_dict = {
                    "gene_id": row[0],
                    "date_created": datetime.strptime(row[1], "%Y-%m-%dT%H:%M:%S.%f"),
                    "metadata": metadata,
                    "de_novo_variant_calculations": de_novo_variant_calculations,
                    "inheritance_type": row[4],
                }

                if DominantDashboardList.objects.filter(gene_id=gene_id).count() > 0:
                    instance = DominantDashboardList.objects.filter(
                        gene_id=gene_id
                    ).first()
                    row_dict.pop("gene_id")
                    serializer = DominantDashboardListSerializer(
                        instance, data=row_dict
                    )
                else:
                    serializer = NewDominantDashboardListSerializer(data=row_dict)

                if serializer.is_valid():
                    serializer.save()

                    dominant_dashboard_list = DominantDashboardList.objects.get(
                        gene_id=gene_id
                    )

                    # check if there is an approved representative variant list for this
                    #   gene, if so set the foreign key relationship here. Check if only
                    #   ENSG and decimal is the same to match on different versions of
                    #   the gene (i.e. ENSG0001.1 == ENSG0001.3, but not ENSG000123.1)

                    gene_id = metadata["gene_id"].split(".")[0]
                    gene_id_with_decimal = f"{gene_id}."

                    dashboard_lists_with_same_gene_id = DashboardList.objects.filter(
                        metadata__gene_id__startswith=gene_id_with_decimal
                    )

                    if dashboard_lists_with_same_gene_id.count() > 0:
                        dashboard_list = dashboard_lists_with_same_gene_id[0]
                        dashboard_list.dominant_dashboard_list = serializer.instance
                        dashboard_list.save()
                    else:
                        # dummy data
                        metadata.setdefault("populations", [])
                        metadata.setdefault("clinvar_version", "unknown")
                        zero_array = [0.0] * 10
                        zero_raw_numbers = [
                            {"total_ac": 0, "average_an": 1} for _ in range(10)
                        ]

                        # Create a new DashboardList entry for this gene
                        placeholder_dashboard_dict = {
                            "gene_id": serializer.instance.gene_id,
                            "label": f"Auto-generated for {serializer.instance.gene_id}",
                            "notes": "Auto-created from DominantDashboardList upload.",
                            "created_at": serializer.instance.date_created,
                            "metadata": metadata,
                            "variant_calculations": {
                                "prevalence": zero_array,
                                "prevalence_bayesian": zero_array,
                                "carrier_frequency": zero_array,
                                "carrier_frequency_simplified": zero_array,
                                "carrier_frequency_raw_numbers": zero_raw_numbers,
                            },
                            "top_ten_variants": [],
                            "genetic_prevalence_orphanet": "",
                            "genetic_prevalence_genereviews": "",
                            "genetic_prevalence_other": "",
                            "genetic_incidence_other": "",
                            "inheritance_type": row[4],
                        }

                        dashboard_serializer = NewDashboardListSerializer(
                            data=placeholder_dashboard_dict
                        )

                        if dashboard_serializer.is_valid():
                            dashboard = dashboard_serializer.save()
                            dashboard.dominant_dashboard_list = serializer.instance
                            dashboard.status = (
                                VariantList.Status.READY
                            )  # Skip processing
                            dashboard.save()
                        else:
                            print(
                                f"Failed to create DashboardList for {serializer.instance.gene_id}:"
                            )
                            print(dashboard_serializer.errors)

                    dominant_dashboard_list.save()

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


class DominantDashboardListsView(ListAPIView):
    def get_queryset(self):
        return DominantDashboardList.objects.all()

    filter_backends = [OrderingFilter]
    ordering_fields = ["date_created"]
    ordering = ["-date_created"]

    def get_serializer_class(self):
        return DominantDashboardListDashboardSerializer


class DominantDashboardListView(RetrieveUpdateDestroyAPIView):
    lookup_field = "gene_id"

    serializer_class = DominantDashboardListSerializer

    def get_queryset(self):
        return DominantDashboardList.objects.all()

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
