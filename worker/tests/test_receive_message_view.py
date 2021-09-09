# pylint: disable=no-self-use
import base64
import json
from unittest.mock import Mock

import pytest
from rest_framework.test import APIClient


class TestReceiveMessage:
    @pytest.fixture(autouse=True)
    def mock_handle_event(self, monkeypatch):
        self.mock_handle_event = Mock()
        monkeypatch.setattr("worker.views.handle_event", self.mock_handle_event)
        yield
        monkeypatch.undo()

    def test_validates_request_format(self):
        client = APIClient()

        response = client.post("/")
        assert response.status_code == 400
        assert not self.mock_handle_event.called

        response = client.post("/", {})
        assert response.status_code == 400
        assert not self.mock_handle_event.called

        response = client.post("/", {"field": "value"})
        assert response.status_code == 400
        assert not self.mock_handle_event.called

        response = client.post("/", {"message": {"field": "value"}})
        assert response.status_code == 400
        assert not self.mock_handle_event.called

    def test_validates_payload_encoding(self):
        client = APIClient()

        response = client.post("/", {"message": {"data": "value"}})
        assert response.status_code == 400
        assert not self.mock_handle_event.called

        response = client.post(
            "/", {"message": {"data": base64.b64encode("value".encode("utf-8"))}}
        )
        assert response.status_code == 400
        assert not self.mock_handle_event.called

    def test_valid_message(self):
        client = APIClient()

        payload = {"field": "value"}
        response = client.post(
            "/",
            {
                "message": {
                    "data": base64.b64encode(json.dumps(payload).encode("utf-8"))
                }
            },
        )
        assert response.status_code == 204
        self.mock_handle_event.assert_called_with(payload)
