from django.apps import AppConfig
from django.core.signals import request_finished


class WorkerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "worker"

    def ready(self):
        from .tasks import (  # pylint: disable=import-outside-toplevel
            initialize_hail,
            exit_if_hail_has_failed,
        )

        # If the worker encounters an error that it can't recover from (such as Hail
        # running out of memory) while processing a variant list, exit after sending
        # a request so that the next request gets a new worker.
        request_finished.connect(exit_if_hail_has_failed)

        initialize_hail()
