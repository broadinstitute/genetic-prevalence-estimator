import nox


nox.options.reuse_existing_virtualenvs = True


@nox.session
def format(session):
    session.install("-r", "dev-requirements.txt")
    session.run("black", "--check", "calculator", "website", "worker")


def install_website_dependencies(session):
    session.install("-r", "shared-requirements.txt")
    session.install("-r", "website/website-requirements.txt")
    session.install("-e", "./website")
    session.install("-e", "./calculator")


WEBSITE_ENV = {
    "DJANGO_SETTINGS_MODULE": "website.settings.development",
    "GCP_PROJECT": "",
    "GOOGLE_AUTH_CLIENT_ID": "",
}


@nox.session
def makemigrations(session):
    install_website_dependencies(session)
    session.run("django-admin", "makemigrations", env=WEBSITE_ENV)


@nox.session
def pylint(session):
    session.install("-r", "dev-requirements.txt")
    install_website_dependencies(session)

    session.run(
        "pylint",
        "calculator/src/calculator",
        "calculator/tests",
        "website/src/website",
        "website/tests",
        env=WEBSITE_ENV,
    )


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
