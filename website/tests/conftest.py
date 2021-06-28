from unittest.mock import Mock

import pytest


@pytest.fixture(autouse=True)
def mock_send_to_worker(monkeypatch):
    monkeypatch.setattr("website.pubsub.publisher.send_to_worker", Mock())
    yield
    monkeypatch.undo()
