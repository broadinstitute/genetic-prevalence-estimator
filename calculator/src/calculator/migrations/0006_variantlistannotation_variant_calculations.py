# Generated by Django 3.2 on 2024-05-03 19:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("calculator", "0005_dashboardlist"),
    ]

    operations = [
        migrations.AddField(
            model_name="variantlistannotation",
            name="variant_calculations",
            field=models.JSONField(default=dict),
        ),
    ]
