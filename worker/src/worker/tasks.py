import hail as hl
from django.conf import settings


def initialize_hail():
    hl.init(
        idempotent=True,
        local="local[1]",
        log=settings.HAIL_LOG_PATH,
        quiet=not settings.DEBUG,
    )
