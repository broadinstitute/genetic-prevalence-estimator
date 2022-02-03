1. Install Terraform.

   https://learn.hashicorp.com/tutorials/terraform/install-cli)

2. Configure variables.

   ```
   cat > terraform.tfvars <<EOF
   gcp_project = ""
   gcp_region = ""
   google_oauth_client_id = ""
   EOF
   ```

   See https://developers.google.com/identity/sign-in/web/sign-in#create_authorization_credentials
   for instructions on creating a Google OAuth client ID.

3. Create a bucket to store Terraform state (if one does not already exist).

   ```
   gsutil mb -p my-project -b on gs://my-bucket
   ```

   Terraform recommends enabling Object Versioning on the bucket.

   https://www.terraform.io/docs/language/settings/backends/gcs.html

   https://cloud.google.com/storage/docs/object-versioning

   ```
   gsutil versioning set on gs://my-bucket
   ```

4. If running Terraform outside of GCP, configure default credentials.

   https://cloud.google.com/docs/authentication/production#automatically

   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   ```

5. Initialize Terraform and configure it to use the bucket to store state.

   ```
   terraform init -backend-config="bucket=my-bucket"
   ```

6. Install the Cloud Build app and connect GitHub repository.

   https://cloud.google.com/build/docs/automating-builds/build-repos-from-github#installing_gcb_app

7. Apply configuration.

   ```
   terraform apply
   ```
