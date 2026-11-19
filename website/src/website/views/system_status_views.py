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
    for vlist in errored_variant_lists:
        error = vlist.error if vlist.error is not None else ""
        lists_with_errors.append(
            {
                "error": error,
                "uuid": vlist.uuid,
                "label": vlist.label,
            }
        )
    return lists_with_errors


def summarize_variant_list(vlist):
    return {
        "uuid": vlist.uuid,
        "label": vlist.label,
        "status": VariantList.Status(vlist.status).label,
        "created_by": vlist.created_by.username if vlist.created_by else None,
        "created_at": vlist.created_at,
        "updated_at": vlist.updated_at,
        "gene_symbol": vlist.metadata.get("gene_symbol"),
        "gnomad_version": vlist.metadata.get("gnomad_version"),
    }


def get_queued_and_processing_lists():
    lists = (
        VariantList.objects.filter(
            status__in=[VariantList.Status.QUEUED, VariantList.Status.PROCESSING]
        )
        .select_related("created_by")
        .order_by("created_at")
    )
    return [summarize_variant_list(vlist) for vlist in lists]


@api_view(["GET"])
@permission_classes([IsAdminUser])
def system_status_view(request):  # pylint: disable=unused-argument
    status = {
        "variant_lists": get_num_variant_lists_by_status(),
        "error_details": get_error_details(),
        "queued_and_processing_lists": get_queued_and_processing_lists(),
    }
    return Response(status)
