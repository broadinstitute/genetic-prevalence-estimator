import pytest

from worker.recycle_policy import should_recycle


def memory(in_use, limit, file_cache=0):
    return {
        "container_memory_bytes": None if in_use is None else in_use + file_cache,
        "container_memory_in_use_bytes": in_use,
        "container_memory_peak_bytes": None,
        "container_memory_limit_bytes": limit,
    }


@pytest.fixture(autouse=True)
def recycle_settings(settings):
    settings.RECYCLE_AFTER_JOBS = 3
    settings.RECYCLE_ABOVE_MEMORY_PERCENT = 60


@pytest.mark.parametrize(
    "outcome", ["error", "connection_refused", "unhandled_exception"]
)
def test_recycles_after_a_failed_job(outcome):
    assert should_recycle(outcome, 1, memory(100, 1000))


def test_keeps_container_below_job_count_and_memory_threshold():
    assert not should_recycle("ready", 2, memory(599, 1000))


def test_recycles_at_job_count():
    assert should_recycle("ready", 3, memory(100, 1000))


def test_recycles_at_memory_threshold():
    assert should_recycle("ready", 1, memory(600, 1000))


def test_ignores_memory_when_it_cannot_be_read():
    assert not should_recycle("ready", 1, memory(None, None))


def test_recycles_after_every_job_when_set_to_one(settings):
    settings.RECYCLE_AFTER_JOBS = 1
    assert should_recycle("ready", 1, memory(100, 1000))


def test_ignores_reclaimable_file_cache():
    assert not should_recycle("ready", 1, memory(500, 1000, file_cache=300))
