# Contributing

## Setting up a development environment

- Install development tools.

  ```
  python3 -m pip install -r dev-requirements.txt
  ```

- Install and configure [git-secrets](https://github.com/awslabs/git-secrets).

  ```
  git secrets --add --literal 'private_key'
  git secrets --add --literal 'private_key_id'
  git secrets --add --literal 'client_id'
  git secrets --add --literal 'client_email'
  ```

- Install pre-commit hooks.

  ```
  python3 -m pre_commit install
  ```

## Running in Docker

This assumes that [BuildKit](https://docs.docker.com/develop/develop-images/build_enhancements/) is enabled.

- Configure app. Create a `.env` file and fill in values for environment variables.

  ```
  cat <<EOF > .env
  SECRET_KEY=
  DB_DATABASE=
  DB_USER=
  DB_PASSWORD=
  GCP_PROJECT=
  EOF
  ```

  To generate a random secret key, use:

  ```
  python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key());'
  ```

- On first run, start database and apply migrations.

  ```
  docker compose up database
  docker compose run --rm website django-admin migrate
  ```

- Start all services.

  ```
  docker compose up
  ```

## Running development tasks

Use [nox](https://nox.thea.codes/en/stable/) to run tasks in a virtualenv with necessary dependencies.

Use `nox -l` to list available tasks. Use `nox -s <name>` to run a specific task.
