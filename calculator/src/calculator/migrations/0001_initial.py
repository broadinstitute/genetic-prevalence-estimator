# Generated by Django 3.2 on 2021-08-09 18:06

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VariantList",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("label", models.CharField(max_length=1000)),
                ("notes", models.TextField(default="")),
                (
                    "type",
                    models.CharField(
                        choices=[("c", "Custom"), ("r", "Recommended")],
                        default="c",
                        max_length=1,
                    ),
                ),
                ("metadata", models.JSONField()),
                ("variants", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("Q", "Queued"),
                            ("P", "Processing"),
                            ("R", "Ready"),
                            ("E", "Error"),
                        ],
                        default="Q",
                        max_length=1,
                    ),
                ),
                ("error", models.TextField(default=None, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_variant_lists",
                        related_query_name="created_variant_list",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="VariantListAccessPermission",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                (
                    "level",
                    models.CharField(
                        choices=[("O", "Owner"), ("E", "Editor"), ("V", "Viewer")],
                        default="V",
                        max_length=1,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "last_updated_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="variant_list_access_permissions",
                        related_query_name="variant_list_access_permission",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "variant_list",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="access_permissions",
                        related_query_name="access_permission",
                        to="calculator.variantlist",
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name="variantlistaccesspermission",
            index=models.Index(fields=["uuid"], name="calculator__uuid_608928_idx"),
        ),
        migrations.AddConstraint(
            model_name="variantlistaccesspermission",
            constraint=models.UniqueConstraint(
                fields=("user", "variant_list"), name="unique variant list access level"
            ),
        ),
        migrations.AddIndex(
            model_name="variantlist",
            index=models.Index(fields=["uuid"], name="calculator__uuid_8660b5_idx"),
        ),
    ]
