from django.apps import AppConfig
from django.core.signals import request_finished


class WorkerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "worker"

    def ready(self):
        from .tasks import (  # pylint: disable=import-outside-toplevel
            initialize_hail,
            exit_after_job_finished,
        )

        # Always terminate the current worker after a job
        #   Current working theory about many queue'd requests causing crashes is
        #   CPU throttling in between jobs causes Java garbage collection
        #   to not happen reliably, leading to OOM errors
        request_finished.connect(exit_after_job_finished)

        initialize_hail()
