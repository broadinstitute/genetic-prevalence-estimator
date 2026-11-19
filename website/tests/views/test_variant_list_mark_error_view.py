import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from calculator.models import VariantList


User = get_user_model()


def create_variant_list(status, notes=""):
    return VariantList.objects.create(
        label="List",
        type=VariantList.Type.CUSTOM,
        metadata={
            "version": "1",
            "reference_genome": "GRCh38",
            "gnomad_version": "4.1.0",
        },
        status=status,
        notes=notes,
    )


def mark_error(username, variant_list, message):
    client = APIClient()
    if username:
        client.force_authenticate(User.objects.get(username=username))
    return client.post(
        f"/api/variant-lists/{variant_list.uuid}/mark-error/",
        {"message": message},
    )


@pytest.mark.django_db
class TestMarkVariantListAsError:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        User.objects.create(username="staffmember", is_staff=True)
        User.objects.create(username="otheruser")

    @pytest.mark.parametrize(
        "username,expected_status",
        [(None, 403), ("otheruser", 403), ("staffmember", 200)],
    )
    def test_requires_staff(self, username, expected_status):
        variant_list = create_variant_list(VariantList.Status.QUEUED)

        response = mark_error(username, variant_list, "Not processed")

        assert response.status_code == expected_status

    @pytest.mark.parametrize("message", ["", "   ", "x" * 1001])
    def test_rejects_missing_or_long_messages(self, message):
        variant_list = create_variant_list(VariantList.Status.QUEUED)

        response = mark_error("staffmember", variant_list, message)

        assert response.status_code == 400
        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.QUEUED

    @pytest.mark.parametrize(
        "status", [VariantList.Status.READY, VariantList.Status.ERROR]
    )
    def test_rejects_lists_that_are_not_queued_or_processing(self, status):
        variant_list = create_variant_list(status)

        response = mark_error("staffmember", variant_list, "Not processed")

        assert response.status_code == 409
        variant_list.refresh_from_db()
        assert variant_list.status == status

    @pytest.mark.parametrize(
        "status", [VariantList.Status.QUEUED, VariantList.Status.PROCESSING]
    )
    def test_marks_list_as_errored_with_message_and_audit_line(self, status):
        variant_list = create_variant_list(status)

        mark_error("staffmember", variant_list, "  Not processed  ")

        variant_list.refresh_from_db()
        assert variant_list.status == VariantList.Status.ERROR
        assert variant_list.error.startswith(
            "Not processed\n\nMarked as errored by staffmember at "
        )

    def test_adds_staff_note_to_empty_notes(self):
        variant_list = create_variant_list(VariantList.Status.QUEUED)

        mark_error("staffmember", variant_list, "Not processed")

        variant_list.refresh_from_db()
        assert variant_list.notes == "[Staff note: Not processed]"

    def test_prepends_staff_note_to_existing_notes(self):
        variant_list = create_variant_list(
            VariantList.Status.QUEUED, notes="Owner's notes"
        )

        mark_error("staffmember", variant_list, "Not processed")

        variant_list.refresh_from_db()
        assert variant_list.notes == "[Staff note: Not processed]\n\nOwner's notes"
