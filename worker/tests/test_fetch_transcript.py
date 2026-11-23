import json
from types import SimpleNamespace

import pytest
import requests

from worker import tasks


TRANSCRIPT = {"transcript_id": "ENST00000302118", "gene": {"symbol": "PCSK9"}}


def test_sets_a_timeout_on_gnomad_api_requests(monkeypatch):
    calls = []

    def fake_post(*args, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(text=json.dumps({"data": {"transcript": TRANSCRIPT}}))

    monkeypatch.setattr(tasks.requests, "post", fake_post)

    assert tasks.fetch_transcript("ENST00000302118", "4.1.1") == TRANSCRIPT
    assert calls[0]["timeout"] == tasks.GNOMAD_API_TIMEOUT_SECONDS


def test_gives_up_after_three_timed_out_requests(monkeypatch):
    calls = []

    def timing_out_post(*args, **kwargs):
        calls.append(kwargs)
        raise requests.exceptions.Timeout()

    monkeypatch.setattr(tasks.requests, "post", timing_out_post)

    with pytest.raises(Exception, match="Failed to fetch transcript."):
        tasks.fetch_transcript("ENST00000302118", "4.1.1")
    assert len(calls) == 3
