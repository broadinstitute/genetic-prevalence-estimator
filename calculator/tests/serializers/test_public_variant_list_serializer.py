# pylint: disable=no-self-use
import uuid

import pytest
from django.contrib.auth import get_user_model

from calculator.models import VariantList, PublicVariantList
from calculator.serializers import (
    NewPublicVariantListSerializer,
    PublicVariantListSerializer,
    PublicVariantListReducedSerializer,
)

User = get_user_model()


def variant_list_fixture():
    return VariantList(
        id=1,
        uuid=uuid.uuid4(),
        label="A variant list",
        type=VariantList.Type.RECOMMENDED,
        metadata={
            "version": "2",
            "gnomad_version": "2.1.1",
            "gene_id": "ENSG00000169174.9",
            "transcript_id": "ENST00000302118.5",
            "gene_symbol": "PCSK9",
            "include_gnomad_plof": True,
        },
        variants=[{"id": "1-55516888-G-GA"}],
        status=VariantList.Status.READY,
    )


@pytest.mark.django_db
class TestNewPublicVariantListSerializer:
    @pytest.fixture(autouse=True)
    def db_setup(self):
        variant_list = variant_list_fixture()
        variant_list.id = 1
        variant_list.save()

        User.objects.create(username="testuser")

    def test_new_public_variant_list_serializer(self):
        # new public list serializers can be created with a variant list and the submitting user
        serializer = NewPublicVariantListSerializer(
            data={
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "testuser",
            }
        )
        assert serializer.is_valid(), serializer.errors

        # submitting user must be a user object
        serializer = NewPublicVariantListSerializer(
            data={
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": 12,
            }
        )
        assert not serializer.is_valid()
        assert "submitted_by" in serializer.errors

        # list are created with a public status of "pending" by default, and that
        #   cannot be overridden
        serializer = NewPublicVariantListSerializer(
            data={
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "testuser",
                "review_status": PublicVariantList.ReviewStatus.APPROVED,
            }
        )
        assert not serializer.is_valid()

        # extra fields are not tolerated
        serializer = NewPublicVariantListSerializer(
            data={
                "variant_list": VariantList.objects.get(id=1).uuid,
                "submitted_by": "testuser",
                "extra_field": "foo",
            }
        )
        assert not serializer.is_valid()


def test_public_variant_list_serializer_serializes_usernames():
    user = User(username="testuser")
    user2 = User(username="testuser2")
    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list, submitted_by=user, reviewed_by=user2
    )
    serializer = PublicVariantListSerializer(public_list)
    assert serializer.data["submitted_by"] == "testuser"
    assert serializer.data["reviewed_by"] == "testuser2"


def test_public_variant_list_serializer_serializes_review_status():
    user = User(username="testuser")
    reviewer = User(username="testreviewer")
    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
        reviewed_by=reviewer,
        review_status=PublicVariantList.ReviewStatus.APPROVED,
    )

    serializer = PublicVariantListSerializer(public_list)
    assert serializer.data["review_status"] == "Approved"


def test_public_variant_list_serializer_allows_editing_review_status():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
    )

    serializer = PublicVariantListSerializer(
        public_list,
        data={
            "review_status": PublicVariantList.ReviewStatus.APPROVED,
        },
        partial=True,
    )

    assert serializer.is_valid(), serializer.errors

    serializer = PublicVariantListSerializer(
        public_list,
        data={
            "review_status": PublicVariantList.ReviewStatus.REJECTED,
        },
        partial=True,
    )

    assert serializer.is_valid(), serializer.errors


@pytest.mark.django_db
def test_public_variant_list_serializer_allows_editing_reviewed_by():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
    )

    serializer = PublicVariantListSerializer(
        public_list,
        data={
            "reviewed_by": "testuser",
        },
        partial=True,
    )

    assert serializer.is_valid(), serializer.errors


def test_public_variant_list_serializer_does_not_allow_editing_variant_list():
    user = User(username="testuser")
    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
    )

    other_list = variant_list_fixture()
    serializer = PublicVariantListSerializer(
        public_list,
        data={"variant_list": other_list},
        partial=True,
    )

    assert not serializer.is_valid()
    assert "variant_list" in serializer.errors


def test_reduced_public_variant_list_serializer_serializes_username():
    user = User(username="testuser")

    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
        review_status=PublicVariantList.ReviewStatus.APPROVED,
    )

    serializer = PublicVariantListReducedSerializer(public_list)
    assert serializer.data["submitted_by"] == "testuser"


def test_reduced_public_variant_list_serializer_does_not_return_reviewer():
    user = User(username="testuser")
    reviewer = User(username="reviewer")

    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
        reviewed_by=reviewer,
        review_status=PublicVariantList.ReviewStatus.APPROVED,
    )

    serializer = PublicVariantListReducedSerializer(public_list)

    with pytest.raises(KeyError):
        # pylint: disable=pointless-statement
        serializer.data["reviewed_by"] == "reviewer"


def test_reduced_public_variant_list_serializer_does_not_return_review_status():
    user = User(username="testuser")
    reviewer = User(username="reviewer")

    variant_list = variant_list_fixture()
    public_list = PublicVariantList(
        variant_list=variant_list,
        submitted_by=user,
        reviewed_by=reviewer,
        review_status=PublicVariantList.ReviewStatus.APPROVED,
    )

    serializer = PublicVariantListReducedSerializer(public_list)

    with pytest.raises(KeyError):
        # pylint: disable=pointless-statement
        serializer.data["review_status"] == "Approved"
