from django.conf import settings
from rest_framework.generics import (
    GenericAPIView,
    ListCreateAPIView,
    RetrieveUpdateAPIView,
    RetrieveUpdateDestroyAPIView,
)

from calculator.models import (
    PrevalenceList,    
)
from calculator.serializers import (
    PrevalenceListSerializer,
)

class PrevalenceListsView(ListCreateAPIView):
    def get_serializer_class(self):
        if self.request.method == "POST":
            return NewPrevalenceListSerializer

        return PrevalenceListSerializer
    
    def perform_create(self, serializer):
        prevalence_list = serializer.save()
        