from unittest.mock import Mock

import pytest

from calculator.models import VariantList
from worker import tasks

DEADLINE_ERROR = "Variant list job exceeded the 450 second deadline"


def create_variant_list(status, error=None):
    return VariantList.objects.create(
        label="List",
        type=VariantList.Type.CUSTOM,
        metadata={
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "4.1.0",
        },
        status=status,
        error=error,
    )


@pytest.fixture(autouse=True)
def mock_process_variant_list(monkeypatch):
    process = Mock()
    monkeypatch.setattr(tasks, "_process_variant_list", process)
    monkeypatch.setattr(tasks, "should_recycle", lambda *_args: False)
    monkeypatch.setattr(tasks, "IS_SHUTTING_DOWN", False)
    return process


@pytest.mark.django_db
def test_list_the_watchdog_failed_for_overrunning_is_skipped(
    mock_process_variant_list,
):
    variant_list = create_variant_list(VariantList.Status.ERROR, DEADLINE_ERROR)

    tasks.process_variant_list(variant_list.uuid)

    mock_process_variant_list.assert_not_called()
    variant_list.refresh_from_db()
    assert variant_list.status == VariantList.Status.ERROR
    assert variant_list.error == DEADLINE_ERROR


@pytest.mark.django_db
@pytest.mark.parametrize(
    "status,error",
    [
        (VariantList.Status.QUEUED, None),
        (VariantList.Status.QUEUED, DEADLINE_ERROR),
        (VariantList.Status.ERROR, "Hail JVM exited with code -9"),
        (VariantList.Status.ERROR, "Stuck.\n\nMarked as errored by staff at 2026."),
    ],
    ids=[
        "queued",
        "re-queued after overrunning",
        "JVM died",
        "marked errored by staff",
    ],
)
def test_other_lists_are_processed(mock_process_variant_list, status, error):
    variant_list = create_variant_list(status, error)

    tasks.process_variant_list(variant_list.uuid)

    mock_process_variant_list.assert_called_once()
    variant_list.refresh_from_db()
    assert variant_list.status == VariantList.Status.READY
