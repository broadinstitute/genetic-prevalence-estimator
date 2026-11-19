from gunicorn.errors import HaltServer


def child_exit(server, worker):  # pylint: disable=unused-argument
    # The arbiter empties LISTENERS once it starts stopping, so this only
    # halts on a worker exit gunicorn would otherwise answer with a respawn.
    if server.LISTENERS:
        raise HaltServer("Worker exited; exiting so Cloud Run replaces the instance")
