from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from calculator.models import VariantListAccessPermission
from calculator.serializers import (
    NewVariantListAccessPermissionSerializer,
    VariantListAccessPermissionSerializer,
)
from website.permissions import ViewObjectPermissions


class VariantListAccessList(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        create_serializer = NewVariantListAccessPermissionSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        if (
            VariantListAccessPermission.objects.filter(
                user=request.user,
                variant_list=create_serializer.validated_data["variant_list"],
                level=VariantListAccessPermission.Level.OWNER,
            ).count()
            == 0
        ):
            raise PermissionDenied

        new_access = create_serializer.save(created_by=request.user)
        serializer = VariantListAccessPermissionSerializer(new_access)
        return Response({"variant_list_access": serializer.data})


class VariantListAccessDetail(RetrieveUpdateDestroyAPIView):
    queryset = VariantListAccessPermission.objects.all()

    lookup_field = "uuid"

    permission_classes = (IsAuthenticated, ViewObjectPermissions)

    serializer_class = VariantListAccessPermissionSerializer

    def get_serializer_context(self):
        return {"current_user": self.request.user}

    def perform_update(self, serializer):
        serializer.save(last_updated_by=self.request.user)
