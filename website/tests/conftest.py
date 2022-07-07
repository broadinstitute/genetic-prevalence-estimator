from unittest.mock import Mock

import pytest


@pytest.fixture(autouse=True)
def send_to_worker(monkeypatch):
    mock_send_to_worker = Mock()
    monkeypatch.setattr("website.pubsub.publisher.send_to_worker", mock_send_to_worker)
    yield mock_send_to_worker
    monkeypatch.undo()
