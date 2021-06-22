1. Install Terraform.

   https://learn.hashicorp.com/tutorials/terraform/install-cli)

2. Configure variables.

   ```
   cat > terraform.tfvars <<EOF
   gcp_project = ""
   gcp_region = ""
   data_bucket = ""
   EOF
   ```

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
