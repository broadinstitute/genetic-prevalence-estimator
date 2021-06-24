import uuid

from django.conf import settings
from django.db import models


class VariantList(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)

    label = models.CharField(max_length=1000)

    description = models.TextField(default="")

    class Type(models.TextChoices):
        CUSTOM = ("custom", "Custom")
        GNOMAD = ("gnomad", "gnomAD")

    type = models.CharField(max_length=10, choices=Type.choices, default=Type.CUSTOM)

    metadata = models.JSONField()

    variants = models.JSONField(default=list)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="created_variant_lists",
        related_query_name="created_variant_list",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Status(models.TextChoices):
        QUEUED = (
            "Q",
            "Queued",
        )
        PROCESSING = (
            "P",
            "Processing",
        )
        READY = (
            "R",
            "Ready",
        )
        ERROR = "E", "Error"

    status = models.CharField(
        max_length=1, choices=Status.choices, default=Status.QUEUED
    )

    class Meta:
        indexes = [models.Index(fields=("uuid",))]


class VariantListAccess(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    variant_list = models.ForeignKey(
        VariantList,
        on_delete=models.CASCADE,
        related_name="access_permissions",
        related_query_name="access_permission",
    )

    class Level(models.TextChoices):
        OWNER = ("O", "Owner")
        EDITOR = ("E", "Editor")
        VIEWER = ("V", "Viewer")

    level = models.CharField(max_length=1, choices=Level.choices, default=Level.VIEWER)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        indexes = [models.Index(fields=("uuid",))]

        constraints = [
            models.UniqueConstraint(
                fields=("user", "variant_list"), name="unique variant list access level"
            )
        ]
