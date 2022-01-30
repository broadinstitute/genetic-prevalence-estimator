import os

import nox


nox.options.reuse_existing_virtualenvs = True


@nox.session(name="format")
def format_code(session):
    """Format code with Black."""
    session.install("-r", "dev-requirements.txt")
    session.run("black", "calculator", "website", "worker", "data-pipelines")


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
}


WORKER_ENV = {
    "DJANGO_SETTINGS_MODULE": "worker.settings.development",
    "GNOMAD_DATA_PATH": os.path.join(os.path.dirname(__file__), "data"),
    "CLINVAR_DATA_PATH": os.path.join(os.path.dirname(__file__), "data"),
}


@nox.session
def makemigrations(session):
    """Run django-admin makemigrations."""
    install_website_dependencies(session)
    session.run("django-admin", "makemigrations", env=WEBSITE_ENV)


@nox.session(name="pylint:website")
def website_pylint(session):
    """Run Pylint on website and calculator directories."""
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
    """Run Pylint on worker directory."""
    session.install("-r", "dev-requirements.txt")
    install_worker_dependencies(session)

    session.run(
        "pylint",
        "--load-plugins=pylint_django",
        "worker/src/worker",
        "worker/tests",
        env=WORKER_ENV,
    )


@nox.session(name="pylint:data-pipelines")
def data_pipelines_pylint(session):
    """Run Pylint on data-pipelines directory."""
    session.install("-r", "dev-requirements.txt")
    session.install("hail==0.2.65")

    session.run("pylint", "data-pipelines")


@nox.session(name="tests:website")
def website_tests(session):
    """Run website and calculator tests."""
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


@nox.session(name="tests:worker")
def worker_tests(session):
    """Run worker tests."""
    session.install("-r", "dev-requirements.txt")
    install_worker_dependencies(session)
    session.run(
        "pytest",
        "worker/tests",
        env={**WORKER_ENV, "DJANGO_SETTINGS_MODULE": "worker.settings.test"},
    )
