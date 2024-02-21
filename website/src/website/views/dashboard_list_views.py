from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import (
    IsAuthenticated,
    IsAuthenticatedOrReadOnly,
)

from calculator.models import DashboardList
from calculator.serializers import (
    NewDashboardListSerializer,
    DashboardListSerializer,
)
from website.pubsub import publisher


class DashboardListsView(ListCreateAPIView):
    def get_queryset(self):
        # return DashboardList.objects.filter(access_permission__user=self.request.user)
        return DashboardList.objects.all()

    permission_classes = (IsAuthenticated,)

    filter_backends = [OrderingFilter]
    ordering_fields = ["label", "updated_at"]
    ordering = ["-updated_at"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewDashboardListSerializer

        return DashboardListSerializer

    def perform_create(self, serializer):
        if not self.request.user.is_staff:
            raise PermissionDenied

        dashboard_list = serializer.save()

        publisher.send_to_worker(
            {
                "type": "process_dashboard_list",
                "args": {"uuid": str(dashboard_list.uuid)},
            }
        )

    def get_success_headers(self, data):
        try:
            return {"Location": f"/api/dashboard-lists/{data['uuid']}/"}
        except KeyError:
            return {}


class DashboardListView(RetrieveUpdateDestroyAPIView):
    lookup_field = "uuid"

    permission_classes = (IsAuthenticatedOrReadOnly,)

    serializer_class = DashboardListSerializer

    def get_queryset(self):
        return DashboardList.objects.all()

    def get(self, request, *args, **kwargs):
        return self.retrieve(request, *args, **kwargs)

    def put(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.update(request, *args, **kwargs)

    def patch(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.partial_update(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        if not self.request.user.is_staff:
            raise PermissionDenied
        return self.destroy(request, *args, **kwargs)
