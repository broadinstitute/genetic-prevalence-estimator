from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from website.serializers import UserSerializer, NewUserSerializer


class UsersList(ListCreateAPIView):
    queryset = get_user_model().objects.all()

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
    queryset = get_user_model().objects.all()

    lookup_field = "id"

    permission_classes = (IsAuthenticated, IsAdminUser)

    serializer_class = UserSerializer

    def perform_update(self, serializer):
        if serializer.instance == self.request.user:
            raise PermissionDenied

        serializer.save()
