from django.conf import settings


def should_recycle(outcome, jobs_run, memory):
    if outcome != "ready":
        return True
    if jobs_run >= settings.RECYCLE_AFTER_JOBS:
        return True
    used = memory["container_memory_in_use_bytes"]
    limit = memory["container_memory_limit_bytes"]
    if used is None or limit is None:
        return False
    return used * 100 >= limit * settings.RECYCLE_ABOVE_MEMORY_PERCENT
