from django.urls import path

from worker.views import receive_message_view


urlpatterns = [path("", receive_message_view, name="receive-message")]
