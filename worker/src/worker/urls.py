from django.urls import path

from worker.views import receive_message_view


urlpatterns = [path("", receive_message_view, name="receive-message")]

handler400 = "rest_framework.exceptions.bad_request"  # pylint: disable=invalid-name
handler500 = "rest_framework.exceptions.server_error"  # pylint: disable=invalid-name
