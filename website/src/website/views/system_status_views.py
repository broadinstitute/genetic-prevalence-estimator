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


def get_error_details():
    errored_variant_lists = VariantList.objects.filter(status=VariantList.Status.ERROR)
    lists_with_errors = []
    for list in errored_variant_lists:
        error = list.error if list.error is not None else ""
        lists_with_errors.append(
            {
                "error": error,
                "uuid": list.uuid,
                "label": list.label,
            }
        )
    return lists_with_errors


@api_view(["GET"])
@permission_classes([IsAdminUser])
def system_status_view(request):  # pylint: disable=unused-argument
    status = {
        "variant_lists": get_num_variant_lists_by_status(),
        "error_details": get_error_details(),
    }
    return Response(status)
