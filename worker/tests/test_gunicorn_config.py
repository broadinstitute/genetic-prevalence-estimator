from types import SimpleNamespace

import pytest
from gunicorn.errors import HaltServer

from worker.gunicorn_config import child_exit


def test_halts_the_server_when_a_worker_exits_while_serving():
    server = SimpleNamespace(LISTENERS=["socket"])

    with pytest.raises(HaltServer):
        child_exit(server, SimpleNamespace(pid=10))


def test_does_nothing_when_a_worker_exits_during_shutdown():
    server = SimpleNamespace(LISTENERS=[])

    assert child_exit(server, SimpleNamespace(pid=10)) is None
