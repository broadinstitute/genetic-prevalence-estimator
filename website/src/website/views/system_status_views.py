from django.db.models import Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from calculator.models import VariantList


def get_num_variant_lists_by_status():
    num_variant_lists_by_status = {status.label: 0 for status in VariantList.Status}

    num_variant_lists_by_status.update(
        {
            VariantList.Status(result["status"]).label: result["count"]
            for result in VariantList.objects.values("status").annotate(
                count=Count("status")
            )
        }
    )

    return num_variant_lists_by_status


@api_view(["GET"])
@permission_classes([IsAdminUser])
def system_status_view(request):  # pylint: disable=unused-argument
    status = {"variant_lists": get_num_variant_lists_by_status()}
    return Response(status)
