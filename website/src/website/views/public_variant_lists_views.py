from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from website.permissions import ViewObjectPermissions


from calculator.models import (
    VariantList,
    PublicVariantList,
)

from calculator.serializers import (
    NewPublicVariantListSerializer,
    PublicVariantListSerializer,
)


class PublicVariantListsView(ListCreateAPIView):
    def get_queryset(self):
        return PublicVariantList.objects.all()

    ordering_fields = ["updated_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewPublicVariantListSerializer

        return PublicVariantListSerializer

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class PublicVariantListDetail(RetrieveUpdateDestroyAPIView):
    queryset = PublicVariantList.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, IsAdminUser)

    serializer_class = PublicVariantListSerializer
