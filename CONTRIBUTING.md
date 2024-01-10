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

## Preparing data

Run [data pipelines](./data-pipelines/README.md) to prepare a local copy of gnomAD and ClinVar data.

Some data pipeline scripts take an `intervals` argument to select a subset of data.
All take a `partitions` argument to control the number of partitions in the resulting Hail Table.

The Docker Compose configuration for the development environment expects Hail Tables to be located in the `data` directory.

For example, to prepare data for variants in PCSK9:

```
python data-pipelines/prepare_gnomad_variants.py --gnomad-version 2 --intervals 1:55505221-55530525 --partitions 2 ./data/gnomAD_v2.1.1_variants.ht
python data-pipelines/prepare_gnomad_variants.py --gnomad-version 4 --intervals chr1:55039447-55064852 --partitions 2 ./data/gnomAD_v4.0.0_variants.ht

python data-pipelines/import_lof_curation_results.py --gnomad-version 2 -intervals 1:55505221-55530525 --partitions=2 ./data/gnomAD_v2.1.1_lof_curation_results.ht

python data-pipelines/import_clinvar.py --reference-genome GRCh37 --intervals 1:55505221-55530525 --partitions 2 ./data/ClinVar_GRCh37_variants.ht
python data-pipelines/import_clinvar.py --reference-genome GRCh38 --intervals chr1:55039447-55064852 --partitions 2 ./data/ClinVar_GRCh38_variants.ht
```

As a shortcut, to prepare data for variants in PCSK9, run `./scripts/prepare_test_data.sh`.

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

- On first run, create a user.

  Users created by the application are inactive by default. The first user cannot be activated through the application UI.

  - Start a REPL.

    ```
    docker compose exec website django-admin shell
    ```

  - Create a user or activate an existing user.

    ```
    from django.contrib.auth import get_user_model
    User = get_user_model()

    User.objects.create(username="new_user")

    User.objects.filter(username="existing_user").update(is_active=True)
    ```

## Running development tasks

Use [nox](https://nox.thea.codes/en/stable/) to run tasks in a virtualenv with necessary dependencies.

Use `nox -l` to list available tasks. Use `nox -s <name>` to run a specific task.
