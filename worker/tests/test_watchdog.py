# pylint: disable=attribute-defined-outside-init
import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from calculator.models import VariantList
from worker import watchdog


def create_variant_list(status):
    return VariantList.objects.create(
        label="List",
        type=VariantList.Type.CUSTOM,
        metadata={
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "4.1.0",
        },
        status=status,
    )


def running_java_process():
    return SimpleNamespace(poll=lambda: None, returncode=None)


def exited_java_process(returncode):
    return SimpleNamespace(poll=lambda: returncode, returncode=returncode)


@pytest.mark.django_db
class TestWatchdog:
    @pytest.fixture(autouse=True)
    def mock_exit_container(self, monkeypatch):
        self.exit_container = Mock()
        monkeypatch.setattr(watchdog, "exit_container", self.exit_container)
        monkeypatch.setattr(
            watchdog,
            "state",
            watchdog.WatchdogState(java_process=running_java_process()),
        )

    def test_does_nothing_while_java_is_running(self):
        variant_list = create_variant_list(VariantList.Status.PROCESSING)
        watchdog.start_job(variant_list.uuid)

        watchdog.exit_if_failed()

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.PROCESSING
        assert not self.exit_container.called

    def test_marks_current_list_as_error_and_exits_when_java_exits(self, monkeypatch):
        variant_list = create_variant_list(VariantList.Status.PROCESSING)
        watchdog.start_job(variant_list.uuid)
        monkeypatch.setattr(watchdog.state, "java_process", exited_java_process(137))

        watchdog.exit_if_failed()

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.ERROR
        assert variant_list.error == "Hail JVM exited with code 137"
        assert self.exit_container.called

    def test_exits_when_java_exits_between_jobs(self, monkeypatch):
        monkeypatch.setattr(watchdog.state, "java_process", exited_java_process(137))

        watchdog.exit_if_failed()

        assert self.exit_container.called

    def test_leaves_finished_list_unchanged_when_java_exits(self, monkeypatch):
        variant_list = create_variant_list(VariantList.Status.READY)
        watchdog.start_job(variant_list.uuid)
        monkeypatch.setattr(watchdog.state, "java_process", exited_java_process(137))

        watchdog.exit_if_failed()

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.READY
        assert self.exit_container.called

    def test_finish_job_clears_current_job(self):
        variant_list = create_variant_list(VariantList.Status.PROCESSING)
        watchdog.start_job(variant_list.uuid)

        watchdog.finish_job()

        assert watchdog.state.current_job is None

    def test_marks_current_list_as_error_and_exits_when_job_exceeds_deadline(
        self, settings
    ):
        settings.JOB_DEADLINE_SECONDS = 10
        variant_list = create_variant_list(VariantList.Status.PROCESSING)
        watchdog.state.current_job = watchdog.Job(
            uid=variant_list.uuid, started_at=time.monotonic() - 11
        )

        watchdog.exit_if_failed()

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.ERROR
        assert variant_list.error == "Variant list job exceeded the 10 second deadline"
        assert self.exit_container.called

    def test_does_nothing_while_job_is_within_deadline(self, settings):
        settings.JOB_DEADLINE_SECONDS = 10
        variant_list = create_variant_list(VariantList.Status.PROCESSING)
        watchdog.state.current_job = watchdog.Job(
            uid=variant_list.uuid, started_at=time.monotonic() - 9
        )

        watchdog.exit_if_failed()

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.PROCESSING
        assert not self.exit_container.called
