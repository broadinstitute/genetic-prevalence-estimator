from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from calculator.models import VariantListAccess
from calculator.serializers import (
    NewVariantListAccessSerializer,
    VariantListAccessSerializer,
)


class VariantListAccessList(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        create_serializer = NewVariantListAccessSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        if (
            VariantListAccess.objects.filter(
                user=request.user,
                variant_list=create_serializer.validated_data["variant_list"],
                level=VariantListAccess.Level.OWNER,
            ).count()
            == 0
        ):
            raise PermissionDenied

        new_access = create_serializer.save(created_by=request.user)
        serializer = VariantListAccessSerializer(new_access)
        return Response({"variant_list_access": serializer.data})


class VariantListAccessDetail(APIView):
    permission_classes = (IsAuthenticated,)

    def get_variant_list_access(self):
        access = get_object_or_404(VariantListAccess, uuid=self.kwargs["uuid"])
        if access.user == self.request.user:
            return access, access.level

        current_user_list_access = get_object_or_404(
            VariantListAccess, user=self.request.user, variant_list=access.variant_list
        )
        if current_user_list_access.level == VariantListAccess.Level.OWNER:
            return access, current_user_list_access.level

        raise NotFound

    def get(self, request, uuid):  # pylint: disable=unused-argument
        access, _ = self.get_variant_list_access()
        serializer = VariantListAccessSerializer(
            access, context={"current_user": request.user}
        )
        return Response({"variant_list_access": serializer.data})

    def patch(self, request, uuid):  # pylint: disable=unused-argument
        access, current_user_access_level = self.get_variant_list_access()
        if current_user_access_level != VariantListAccess.Level.OWNER:
            raise PermissionDenied
        if access.user == request.user:
            raise PermissionDenied

        serializer = VariantListAccessSerializer(
            access, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({"variant_list_access": serializer.data})

    def delete(self, request, uuid):  # pylint: disable=unused-argument
        access, current_user_access_level = self.get_variant_list_access()
        if current_user_access_level != VariantListAccess.Level.OWNER:
            raise PermissionDenied
        if access.user == request.user:
            raise PermissionDenied

        access.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
