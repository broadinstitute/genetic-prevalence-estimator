# Administration

## Running data pipelines

Data pipelines are run via Cloud Build.

- To run pipelines from the Cloud Console, go to the [Cloud Build Triggers section](https://console.cloud.google.com/cloud-build/triggers), click the "Run" button for the appropriate trigger, select a revision (usually the "main" branch), and click "Run Trigger".

- To run pipelines with `gcloud`, run `gcloud builds triggers run <trigger name>`. To list all triggers, run `gcloud builds triggers list --format="value(name)"`.

## Running database migrations

Database migrations are run via Cloud Build.

- To run pipelines from the Cloud Console, go to the [Cloud Build Triggers section](https://console.cloud.google.com/cloud-build/triggers), click the "Run" button for the "db-migrations" trigger, select a revision (usually the "main" branch), and click "Run Trigger".

- To run database migrations with `gcloud`, run `gcloud builds triggers run db-migrations`.
