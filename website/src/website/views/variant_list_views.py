from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from calculator.models import VariantList, VariantListAccessPermission
from calculator.serializers import NewVariantListSerializer, VariantListSerializer


class VariantListsView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        variant_lists = VariantList.objects.filter(access_permission__user=request.user)
        serializer = VariantListSerializer(variant_lists, many=True)
        return Response({"variant_lists": serializer.data})

    def post(self, request):
        create_serializer = NewVariantListSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)

        variant_list = create_serializer.save(created_by=request.user)
        VariantListAccessPermission.objects.create(
            variant_list=variant_list,
            user=request.user,
            level=VariantListAccessPermission.Level.OWNER,
        )

        serializer = VariantListSerializer(variant_list)
        return Response({"variant_list": serializer.data})


class VariantListView(APIView):
    permission_classes = (IsAuthenticated,)

    def get_variant_list(self):
        variant_list = get_object_or_404(VariantList, uuid=self.kwargs["uuid"])
        variant_list_access = get_object_or_404(
            VariantListAccessPermission,
            user=self.request.user,
            variant_list=variant_list,
        )
        return variant_list, variant_list_access.level

    def get(self, request, uuid):  # pylint: disable=unused-argument
        variant_list, _ = self.get_variant_list()
        serializer = VariantListSerializer(
            variant_list, context={"current_user": request.user}
        )
        return Response({"variant_list": serializer.data})

    def patch(self, request, uuid):  # pylint: disable=unused-argument
        variant_list, access_level = self.get_variant_list()
        if access_level not in (
            VariantListAccessPermission.Level.OWNER,
            VariantListAccessPermission.Level.EDITOR,
        ):
            raise PermissionDenied

        serializer = VariantListSerializer(
            variant_list, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"variant_list": serializer.data})

    def delete(self, request, uuid):  # pylint: disable=unused-argument
        variant_list, access_level = self.get_variant_list()
        if access_level != VariantListAccessPermission.Level.OWNER:
            raise PermissionDenied

        variant_list.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
