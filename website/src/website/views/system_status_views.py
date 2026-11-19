from collections import Counter
from datetime import timedelta

from django.db.models import Count, Max
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from calculator.models import VariantList


STUCK_AFTER = timedelta(minutes=30)
ABANDONED_AFTER = timedelta(days=7)
RECENT_PERIOD = timedelta(days=7)

WAITING_STATUSES = [VariantList.Status.QUEUED, VariantList.Status.PROCESSING]


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


def variant_list_bucket(updated_at, now):
    age = now - updated_at
    if age < STUCK_AFTER:
        return "active"
    if age < ABANDONED_AFTER:
        return "stuck"
    return "abandoned"


def get_variant_list_counts(now):
    waiting_updated_ats = list(
        VariantList.objects.filter(status__in=WAITING_STATUSES).values_list(
            "updated_at", flat=True
        )
    )
    buckets = Counter(
        variant_list_bucket(updated_at, now) for updated_at in waiting_updated_ats
    )
    stuck_updated_ats = [
        updated_at
        for updated_at in waiting_updated_ats
        if variant_list_bucket(updated_at, now) == "stuck"
    ]
    recent_since = now - RECENT_PERIOD
    recently_updated = VariantList.objects.filter(updated_at__gte=recent_since)

    return {
        "right_now": {
            "active": buckets["active"],
            "stuck": buckets["stuck"],
            "oldest_stuck_updated_at": min(stuck_updated_ats, default=None),
            "last_ready_at": VariantList.objects.filter(
                status=VariantList.Status.READY
            ).aggregate(last_ready_at=Max("updated_at"))["last_ready_at"],
        },
        "recent": {
            "created": VariantList.objects.filter(created_at__gte=recent_since).count(),
            "ready": recently_updated.filter(status=VariantList.Status.READY).count(),
            "error": recently_updated.filter(status=VariantList.Status.ERROR).count(),
        },
        "all_time": {
            "total": VariantList.objects.count(),
            "ready": VariantList.objects.filter(
                status=VariantList.Status.READY
            ).count(),
            "error": VariantList.objects.filter(
                status=VariantList.Status.ERROR
            ).count(),
            "abandoned": buckets["abandoned"],
        },
    }


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


def get_error_details():
    lists = (
        VariantList.objects.filter(status=VariantList.Status.ERROR)
        .select_related("created_by")
        .order_by("-updated_at")
    )
    return [
        {**summarize_variant_list(vlist), "error": vlist.error or ""} for vlist in lists
    ]


def get_queued_and_processing_lists(now):
    lists = (
        VariantList.objects.filter(status__in=WAITING_STATUSES)
        .select_related("created_by")
        .order_by("created_at")
    )
    return [
        {
            **summarize_variant_list(vlist),
            "bucket": variant_list_bucket(vlist.updated_at, now),
        }
        for vlist in lists
    ]


@api_view(["GET"])
@permission_classes([IsAdminUser])
def system_status_view(request):  # pylint: disable=unused-argument
    now = timezone.now()
    status = {
        "variant_lists": get_num_variant_lists_by_status(),
        "counts": get_variant_list_counts(now),
        "thresholds": {
            "stuck_after_minutes": STUCK_AFTER // timedelta(minutes=1),
            "abandoned_after_days": ABANDONED_AFTER.days,
            "recent_days": RECENT_PERIOD.days,
        },
        "error_details": get_error_details(),
        "queued_and_processing_lists": get_queued_and_processing_lists(now),
    }
    return Response(status)
