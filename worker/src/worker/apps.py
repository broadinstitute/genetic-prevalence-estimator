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

        request_finished.connect(exit_after_job_finished)

        initialize_hail()
