# Generated by Django 3.2 on 2023-09-19 04:43

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("calculator", "0002_variantlistannotation"),
    ]

    operations = [
        migrations.AddField(
            model_name="variantlist",
            name="public_status",
            field=models.CharField(
                choices=[
                    ("", "Private"),
                    ("P", "Pending"),
                    ("R", "Rejected"),
                    ("A", "Approved"),
                ],
                default="",
                max_length=1,
            ),
        ),
        migrations.AddField(
            model_name="variantlist",
            name="public_status_updated_by",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddIndex(
            model_name="variantlist",
            index=models.Index(
                fields=["public_status"], name="calculator__public__7dc677_idx"
            ),
        ),
    ]
