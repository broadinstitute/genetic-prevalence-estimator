import logging
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList
from worker import job_summary


def test_container_memory_reads_cgroup_v2_files(tmp_path):
    (tmp_path / "memory.current").write_text("1000\n")
    (tmp_path / "memory.peak").write_text("2000\n")
    (tmp_path / "memory.max").write_text("4000\n")

    assert job_summary.container_memory(tmp_path, tmp_path) == {
        "container_memory_source": "cgroup_v2",
        "container_memory_bytes": 1000,
        "container_memory_peak_bytes": 2000,
        "container_memory_limit_bytes": 4000,
    }


def test_container_memory_treats_cgroup_v2_max_as_no_limit(tmp_path):
    (tmp_path / "memory.current").write_text("1000\n")
    (tmp_path / "memory.max").write_text("max\n")

    assert job_summary.container_memory(tmp_path, tmp_path) == {
        "container_memory_source": "cgroup_v2",
        "container_memory_bytes": 1000,
        "container_memory_peak_bytes": None,
        "container_memory_limit_bytes": None,
    }


def test_container_memory_falls_back_to_cgroup_v1_files(tmp_path):
    (tmp_path / "memory").mkdir()
    (tmp_path / "memory" / "memory.usage_in_bytes").write_text("1000\n")
    (tmp_path / "memory" / "memory.max_usage_in_bytes").write_text("2000\n")
    (tmp_path / "memory" / "memory.limit_in_bytes").write_text("4000\n")

    assert job_summary.container_memory(tmp_path, tmp_path) == {
        "container_memory_source": "cgroup_v1",
        "container_memory_bytes": 1000,
        "container_memory_peak_bytes": 2000,
        "container_memory_limit_bytes": 4000,
    }


def test_container_memory_treats_unlimited_cgroup_v1_limit_as_no_limit(tmp_path):
    (tmp_path / "memory").mkdir()
    (tmp_path / "memory" / "memory.usage_in_bytes").write_text("1000\n")
    (tmp_path / "memory" / "memory.limit_in_bytes").write_text("9223372036854771712\n")

    assert (
        job_summary.container_memory(tmp_path, tmp_path)["container_memory_limit_bytes"]
        is None
    )


def test_container_memory_falls_back_to_meminfo(tmp_path):
    (tmp_path / "meminfo").write_text(
        "MemTotal:        4000 kB\nMemFree:          500 kB\n"
        "MemAvailable:    3000 kB\n"
    )

    assert job_summary.container_memory(tmp_path, tmp_path) == {
        "container_memory_source": "meminfo",
        "container_memory_bytes": 1000 * 1024,
        "container_memory_peak_bytes": None,
        "container_memory_limit_bytes": 4000 * 1024,
    }


def test_container_memory_is_none_when_nothing_is_readable(tmp_path):
    assert job_summary.container_memory(tmp_path, tmp_path) == {
        "container_memory_source": None,
        "container_memory_bytes": None,
        "container_memory_peak_bytes": None,
        "container_memory_limit_bytes": None,
    }


def test_process_memory_bytes_reads_resident_set_size(tmp_path):
    (tmp_path / "123").mkdir()
    (tmp_path / "123" / "status").write_text(
        "Name:\tjava\nVmPeak:\t  900 kB\nVmRSS:\t  512 kB\nThreads:\t40\n"
    )

    assert job_summary.process_memory_bytes(123, tmp_path) == 512 * 1024


def test_process_memory_bytes_is_none_for_missing_process(tmp_path):
    assert job_summary.process_memory_bytes(123, tmp_path) is None


@pytest.mark.django_db
def test_log_job_summary_logs_list_details_and_memory(caplog, monkeypatch):
    monkeypatch.setattr(job_summary, "process_memory_bytes", lambda pid: 512)
    variant_list = VariantList.objects.create(
        label="List",
        type=VariantList.Type.CUSTOM,
        metadata={
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "4.1.0",
            "gene_symbol": "PCSK9",
        },
        created_by=get_user_model().objects.create(username="submitter"),
    )

    with caplog.at_level(logging.INFO, logger="worker.job_summary"):
        job_summary.log_job_summary(
            variant_list,
            "ready",
            107.534,
            2,
            SimpleNamespace(pid=123),
            {
                "container_memory_bytes": 1000,
                "container_memory_peak_bytes": 2000,
                "container_memory_limit_bytes": 4000,
            },
            False,
        )

    assert caplog.records[-1].json_fields == {
        "variant_list": str(variant_list.uuid),
        "created_by": "submitter",
        "gene_symbol": "PCSK9",
        "gnomad_version": "4.1.0",
        "outcome": "ready",
        "duration_seconds": 107.53,
        "jobs_run_by_container": 2,
        "recycling": False,
        "container_memory_bytes": 1000,
        "container_memory_peak_bytes": 2000,
        "container_memory_limit_bytes": 4000,
        "java_memory_bytes": 512,
    }
