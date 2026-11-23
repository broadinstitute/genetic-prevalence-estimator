import logging
import os
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass

import pyspark
from django.conf import settings
from django.utils import timezone

from calculator.models import VariantList


logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 5
DEADLINE_EXCEEDED_ERROR_PREFIX = "Variant list job exceeded the"


@dataclass(frozen=True)
class Job:
    uid: object
    started_at: float


@dataclass
class WatchdogState:
    java_process: subprocess.Popen | None = None
    current_job: Job | None = None


state = WatchdogState()


def start_job(uid):
    state.current_job = Job(uid=uid, started_at=time.monotonic())


def finish_job():
    state.current_job = None


def java_exit_reason():
    java_process = state.java_process
    if java_process is None or java_process.poll() is None:
        return None
    return f"Hail JVM exited with code {java_process.returncode}"


def deadline_exceeded_reason():
    job = state.current_job
    if job is None:
        return None
    if time.monotonic() - job.started_at <= settings.JOB_DEADLINE_SECONDS:
        return None
    return f"{DEADLINE_EXCEEDED_ERROR_PREFIX} {settings.JOB_DEADLINE_SECONDS} second deadline"


def find_failure():
    return java_exit_reason() or deadline_exceeded_reason()


def exit_container():
    sys.stdout.flush()
    sys.stderr.flush()
    os.kill(os.getppid(), signal.SIGTERM)
    os._exit(1)


def fail_current_job_and_exit(reason):
    try:
        logger.error("%s. Terminating container.", reason)
        job = state.current_job
        if job is not None:
            VariantList.objects.filter(
                uuid=job.uid, status=VariantList.Status.PROCESSING
            ).update(
                status=VariantList.Status.ERROR,
                error=reason,
                updated_at=timezone.now(),
            )
    except Exception:  # pylint: disable=broad-except
        logger.exception("Unable to mark the current variant list as errored")
    finally:
        exit_container()


def exit_if_failed():
    reason = find_failure()
    if reason:
        fail_current_job_and_exit(reason)


def watch():
    while True:
        time.sleep(CHECK_INTERVAL_SECONDS)
        exit_if_failed()


def start_watching_hail_jvm():
    # pylint: disable-next=protected-access
    state.java_process = pyspark.SparkContext._gateway.proc
    threading.Thread(target=watch, name="watchdog", daemon=True).start()
