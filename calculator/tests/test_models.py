# pylint: disable=no-self-use
import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList, VariantListAccess


User = get_user_model()


class TestVariantList:
    @pytest.mark.django_db
    def test_deleting_variant_list_deletes_permission_models(self):
        viewer = User.objects.create(username="viewer")
        editor = User.objects.create(username="editor")
        owner = User.objects.create(username="owner")
        User.objects.create(username="other")

        variant_list = VariantList.objects.create(
            id=1,
            label="Test list",
            description="Initial description",
            type=VariantList.Type.CUSTOM,
            metadata={"version": "1", "reference_genome": "GRCh37"},
            variants=["1-55516888-G-GA"],
        )

        VariantListAccess.objects.create(
            user=viewer, variant_list=variant_list, level=VariantListAccess.Level.VIEWER
        )
        VariantListAccess.objects.create(
            user=editor, variant_list=variant_list, level=VariantListAccess.Level.EDITOR
        )
        VariantListAccess.objects.create(
            user=owner, variant_list=variant_list, level=VariantListAccess.Level.OWNER
        )

        assert VariantListAccess.objects.count() == 3
        variant_list.delete()
        assert VariantListAccess.objects.count() == 0
