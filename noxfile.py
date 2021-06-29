import os

import nox


nox.options.reuse_existing_virtualenvs = True


@nox.session
def format(session):
    session.install("-r", "dev-requirements.txt")
    session.run("black", "--check", "calculator", "website", "worker", "data-pipelines")


def install_website_dependencies(session):
    session.install("-r", "shared-requirements.txt")
    session.install("-r", "website/website-requirements.txt")
    session.install("-e", "./website")
    session.install("-e", "./calculator")


def install_worker_dependencies(session):
    session.install("-r", "shared-requirements.txt")
    session.install("-r", "worker/worker-requirements.txt")
    session.install("-e", "./worker")
    session.install("-e", "./calculator")


WEBSITE_ENV = {
    "DJANGO_SETTINGS_MODULE": "website.settings.development",
    "GCP_PROJECT": "",
    "GOOGLE_AUTH_CLIENT_ID": "",
}


WORKER_ENV = {
    "DJANGO_SETTINGS_MODULE": "worker.settings.development",
    "DATA_PATH": os.path.join(os.path.dirname(__file__), "data"),
}


@nox.session
def makemigrations(session):
    install_website_dependencies(session)
    session.run("django-admin", "makemigrations", env=WEBSITE_ENV)


@nox.session(name="pylint:website")
def website_pylint(session):
    session.install("-r", "dev-requirements.txt")
    install_website_dependencies(session)

    session.run(
        "pylint",
        "--load-plugins=pylint_django",
        "calculator/src/calculator",
        "calculator/tests",
        "website/src/website",
        "website/tests",
        env=WEBSITE_ENV,
    )


@nox.session(name="pylint:worker")
def worker_pylint(session):
    session.install("-r", "dev-requirements.txt")
    install_worker_dependencies(session)

    session.run(
        "pylint",
        "--load-plugins=pylint_django",
        "worker/src/worker",
        env=WORKER_ENV,
    )


@nox.session(name="pylint:data-pipelines")
def data_pipelines_pylint(session):
    session.install("-r", "dev-requirements.txt")
    session.install("hail==0.2.65")

    session.run("pylint", "data-pipelines")


@nox.session
def website_tests(session):
    session.install("-r", "dev-requirements.txt")
    install_website_dependencies(session)
    session.run(
        "pytest",
        "calculator/tests",
        env={**WEBSITE_ENV, "DJANGO_SETTINGS_MODULE": "website.settings.test"},
    )
    session.run(
        "pytest",
        "website/tests",
        env={**WEBSITE_ENV, "DJANGO_SETTINGS_MODULE": "website.settings.test"},
    )
