import os

from google.api_core.exceptions import AlreadyExists
from google.cloud import pubsub_v1


def main():
    project_id = os.environ["GCP_PROJECT"]
    topic_id = "worker-requests"
    subscription_id = "worker-requests-subscription"
    endpoint = "http://worker:8080/"

    publisher = pubsub_v1.PublisherClient()
    subscriber = pubsub_v1.SubscriberClient()
    topic_path = publisher.topic_path(project_id, topic_id)

    try:
        publisher.create_topic(request={"name": topic_path})
        print("Created topic")
    except AlreadyExists:
        print("Topic already exists")

    subscription_path = subscriber.subscription_path(project_id, subscription_id)
    push_config = pubsub_v1.types.PushConfig(push_endpoint=endpoint)

    with subscriber:
        try:
            subscription = subscriber.create_subscription(
                request={
                    "name": subscription_path,
                    "topic": topic_path,
                    "push_config": push_config,
                    "ack_deadline_seconds": 180,  # 3 minute ack deadline in local dev
                }
            )
            print("Created subscription", subscription)
        except AlreadyExists:
            print("Subscription already exists")


if __name__ == "__main__":
    main()
