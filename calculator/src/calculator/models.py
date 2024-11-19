import uuid
from functools import wraps

import rules
from django.conf import settings
from django.db import models


class VariantList(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)

    label = models.CharField(max_length=1000)

    notes = models.TextField(default="")

    supporting_documents = models.JSONField(default=list)

    class Type(models.TextChoices):
        CUSTOM = ("c", "Custom")
        RECOMMENDED = ("r", "Recommended")

    type = models.CharField(max_length=1, choices=Type.choices, default=Type.CUSTOM)

    metadata = models.JSONField()

    variants = models.JSONField(default=list)
    structural_variants = models.JSONField(default=list)

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

    error = models.TextField(null=True, default=None)

    class RepresentativeStatus(models.TextChoices):
        PRIVATE = ("", "Private")
        PENDING = ("P", "Pending")
        REJECTED = ("R", "Rejected")
        APPROVED = ("A", "Approved")

    representative_status = models.CharField(
        max_length=1, choices=RepresentativeStatus.choices, default=""
    )

    representative_status_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    is_public = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=("uuid",)),
            models.Index(fields=("representative_status",)),
        ]


class DashboardList(models.Model):
    gene_id = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=1000)
    notes = models.TextField(default="")

    created_at = models.DateTimeField()

    metadata = models.JSONField()

    variant_calculations = models.JSONField(default=dict)

    genetic_prevalence_orphanet = models.CharField(max_length=100, blank=True)
    genetic_prevalence_genereviews = models.CharField(max_length=100, blank=True)
    genetic_prevalence_other = models.CharField(max_length=100, blank=True)
    genetic_incidence_other = models.CharField(max_length=100, blank=True)

    inheritance_type = models.CharField(max_length=50, blank=True)

    top_ten_variants = models.JSONField(default=list)

    representative_variant_list = models.ForeignKey(
        VariantList,
        null=True,
        on_delete=models.SET_NULL,
        related_name="representative_variant_list",
        related_query_name="representative_variant_list",
    )

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

    error = models.TextField(null=True, default=None)

    class Meta:
        indexes = [
            models.Index(fields=("gene_id",)),
        ]


class VariantListAccessPermission(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="variant_list_access_permissions",
        related_query_name="variant_list_access_permission",
    )

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


class VariantListAnnotation(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.CASCADE,
        related_name="variant_list_annotations",
        related_query_name="variant_list_annotation",
    )

    variant_list = models.ForeignKey(
        VariantList,
        on_delete=models.CASCADE,
        related_name="annotations",
        related_query_name="annotation",
    )

    selected_variants = models.JSONField(default=list)

    not_included_variants = models.JSONField(default=list)

    variant_notes = models.JSONField(default=dict)

    tagged_groups = models.JSONField(default=dict)

    include_homozygotes_in_calculations = models.BooleanField(default=True)
    variant_calculations = models.JSONField(default=dict)


def object_level_predicate(fn):  # pylint: disable=invalid-name
    @rules.predicate
    @wraps(fn)
    def predicate(obj, target=None):
        if target is None:
            return None

        return fn(obj, target)

    return predicate


@object_level_predicate
def is_variant_list_owner(user, variant_list):
    try:
        access = variant_list.access_permissions.get(user=user)
        return access.level == VariantListAccessPermission.Level.OWNER
    except VariantListAccessPermission.DoesNotExist:
        return False


@object_level_predicate
def is_variant_list_editor(user, variant_list):
    try:
        access = variant_list.access_permissions.get(user=user)
        return access.level == VariantListAccessPermission.Level.EDITOR
    except VariantListAccessPermission.DoesNotExist:
        return False


@object_level_predicate
def is_variant_list_viewer(user, variant_list):
    try:
        access = variant_list.access_permissions.get(user=user)
        return access.level == VariantListAccessPermission.Level.VIEWER
    except VariantListAccessPermission.DoesNotExist:
        return False


# pylint: disable=unused-argument
@object_level_predicate
def is_accessing_a_public_variant_list(user, variant_list):
    is_public = variant_list.is_public
    return is_public


@object_level_predicate
def is_accessing_a_representative_variant_list(user, variant_list):
    representative_status = variant_list.representative_status
    return representative_status == VariantList.RepresentativeStatus.APPROVED


# pylint: enable=unused-argument


rules.add_perm("calculator.add_variantlist", rules.is_active)

# pylint: disable=unsupported-binary-operation

rules.add_perm(
    "calculator.view_variantlist",
    is_accessing_a_public_variant_list
    | (
        rules.is_active
        & (is_variant_list_owner | is_variant_list_editor | is_variant_list_viewer)
    )
    | (rules.is_active & rules.is_staff),
)

rules.add_perm(
    "calculator.view_variantlist_error",
    (rules.is_active & rules.is_staff),
)

rules.add_perm(
    "calculator.view_variantlist_accesspermissions",
    (rules.is_active & is_variant_list_owner) | (rules.is_active & rules.is_staff),
)

rules.add_perm(
    "calculator.change_variantlist",
    rules.is_active & (is_variant_list_owner | is_variant_list_editor),
)

# pylint: disable=enable-binary-operation

rules.add_perm("calculator.delete_variantlist", rules.is_active & is_variant_list_owner)

rules.add_perm("calculator.share_variantlist", rules.is_active & is_variant_list_owner)


@object_level_predicate
def can_view_associated_variant_list(user, obj):
    try:
        obj.variant_list.access_permissions.get(user=user)
        return True
    except VariantListAccessPermission.DoesNotExist:
        return False


@object_level_predicate
def is_associated_user(user, obj):
    return obj.user == user


@object_level_predicate
def is_owner_of_associated_variant_list(user, obj):
    try:
        access = obj.variant_list.access_permissions.get(user=user)
        return access.level == VariantListAccessPermission.Level.OWNER
    except VariantListAccessPermission.DoesNotExist:
        return False


rules.add_perm("calculator.add_variantlistaccesspermission", rules.is_active)

rules.add_perm(
    "calculator.view_variantlistaccesspermission",
    rules.is_active & (is_owner_of_associated_variant_list | is_associated_user),
)

rules.add_perm(
    "calculator.change_variantlistaccesspermission",
    rules.is_active
    & is_owner_of_associated_variant_list
    & ~is_associated_user,  # pylint: disable=invalid-unary-operand-type
)

rules.add_perm(
    "calculator.delete_variantlistaccesspermission",
    rules.is_active
    & is_owner_of_associated_variant_list
    & ~is_associated_user,  # pylint: disable=invalid-unary-operand-type
)
