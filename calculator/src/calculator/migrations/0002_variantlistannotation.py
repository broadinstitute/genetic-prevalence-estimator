# Generated by Django 3.2 on 2023-02-27 03:37

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("calculator", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="VariantListAnnotation",
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
                ("selected_variants", models.JSONField(default=list)),
                ("variant_notes", models.JSONField(default=dict)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="variant_list_annotations",
                        related_query_name="variant_list_annotation",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "variant_list",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="annotations",
                        related_query_name="annotation",
                        to="calculator.variantlist",
                    ),
                ),
            ],
        ),
    ]
