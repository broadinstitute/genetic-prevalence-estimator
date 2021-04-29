import json

from django.conf import settings
from google.cloud import pubsub_v1


publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(  # pylint: disable=no-member
    settings.GCP_PROJECT, "worker-requests"
)


def send_to_worker(message, timeout=30):
    encoded_message = json.dumps(message).encode("utf-8")
    future = publisher.publish(topic_path, encoded_message)
    return future.result(timeout)
