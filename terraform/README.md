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

   See https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
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

## Website ingress and Cloud Armor rollout

The website service accepts internal and Cloud Load Balancing ingress, preventing
external clients from bypassing the load balancer through its `run.app` URL.
Public invoker IAM is retained so the public website can still be served through
the load balancer. The worker service and its Pub/Sub push endpoint are unchanged.

`cloud-armor.tf` defines `website-security-policy`, attached to the website backend:

- Priority 1000: SQL-injection rules (`sqli-v33-stable`), sensitivity 1, preview.
- Priority 1001: XSS rules (`xss-v33-stable`), sensitivity 1, preview.
- Default: allow public traffic.

**Preview rules log matches but do not block requests.** This uses standard Cloud
Armor policy features without enabling an Enterprise subscription; policy, rule,
and request charges still apply, including in preview. There is no rate limiting.
WAF inspection is not a substitute for application authentication/authorization
or complete validation of uploaded content.

Before rollout, resolve existing Terraform validation errors, check for external
integrations using the direct website `run.app` URL, and review a production plan.
Apply only the intended ingress, build-trigger, security-policy and backend
attachment changes; do not apply unrelated drift or remove existing threat
protection. Merging alone does not update the Terraform-managed Cloud Build
trigger configuration in GCP.

After applying:

1. Verify homepage/API access, Google sign-in, uploads and calculation completion
   via `https://genie.broadinstitute.org`. Verify HTTP still redirects to HTTPS.
2. Verify direct external access to the website's `run.app` URLs is rejected and
   the backend has `website-security-policy` attached.
3. Review representative traffic using the existing full-sample backend request
   logging. A Logs Explorer filter for preview matches is:

   ```text
   resource.type="http_load_balancer"
   resource.labels.project_id="aggregate-frequency-calculator"
   jsonPayload.previewSecurityPolicy.name="website-security-policy"
   ```

4. Check matched rules against legitimate sign-in and variant-upload requests.
   In a separately reviewed change, tune any false positives and set
   `preview = false` on each rule only when ready to enforce it. Update its description at
   the same time. Confirm expected denial of authorized security test requests
   and continued success of real workflows; no matches alone do not prove that
   rule evaluation/logging is working.
5. Recheck website ingress and direct-origin rejection after the next normal
   Cloud Build deployment.

To roll back WAF enforcement, return the affected rules to preview and apply a
reviewed plan. To remove the policy, first detach it from the backend (set
`security_policy = null`); do not delete an attached policy. Keep restricted
website ingress unless intentionally rolling it back separately. Neither the
preview policy nor later enforcement guarantees closure of an SCC finding for
intentional public exposure or the existing HTTP-to-HTTPS redirect.

References:
- https://cloud.google.com/armor/docs/configure-waf
- https://cloud.google.com/armor/docs/request-logging
- https://cloud.google.com/run/docs/securing/ingress
