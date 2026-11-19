from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from website.serializers import UserSerializer, NewUserSerializer


def users_with_last_variant_list_created_at():
    return get_user_model().objects.annotate(
        last_variant_list_created_at=Max("created_variant_list__created_at")
    )


class UsersList(ListCreateAPIView):
    queryset = users_with_last_variant_list_created_at().order_by("-date_joined")

    permission_classes = (IsAuthenticated, IsAdminUser)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewUserSerializer

        return UserSerializer

    def get_success_headers(self, data):
        try:
            return {"Location": f"/api/users/{data['id']}/"}
        except KeyError:
            return {}


class UserDetail(RetrieveUpdateAPIView):
    queryset = users_with_last_variant_list_created_at()

    lookup_field = "id"

    permission_classes = (IsAuthenticated, IsAdminUser)

    serializer_class = UserSerializer

    def perform_update(self, serializer):
        if serializer.instance == self.request.user:
            raise PermissionDenied

        serializer.save()
