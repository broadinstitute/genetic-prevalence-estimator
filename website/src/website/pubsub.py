import json

from django.conf import settings
from google.cloud import pubsub_v1


class Publisher:
    client = None
    topic_path = None

    def send_to_worker(self, message, timeout=30):
        if not self.client:
            self.client = pubsub_v1.PublisherClient()

        if not self.topic_path:
            if not settings.GCP_PROJECT:
                raise RuntimeError("Missing required configuration: GCP_PROJECT")

            self.topic_path = self.client.topic_path(  # pylint: disable=no-member
                settings.GCP_PROJECT, "worker-requests"
            )

        encoded_message = json.dumps(message).encode("utf-8")
        future = self.client.publish(self.topic_path, encoded_message)
        return future.result(timeout)


publisher = Publisher()
