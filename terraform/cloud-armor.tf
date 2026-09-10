resource "google_compute_security_policy" "website" {
  name        = "website-security-policy"
  project     = var.gcp_project
  description = "GENIE website WAF: low-sensitivity SQLi and XSS rules in preview"

  // Preview rules log matches without blocking requests. Review legitimate
  // login and variant-upload traffic before enabling enforcement per rule.
  rule {
    priority    = 1000
    action      = "deny(403)"
    preview     = true
    description = "Preview SQL injection detection at sensitivity 1"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
      }
    }
  }

  rule {
    priority    = 1001
    action      = "deny(403)"
    preview     = true
    description = "Preview cross-site scripting detection at sensitivity 1"

    match {
      expr {
        expression = "evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})"
      }
    }
  }

  // The website remains public; preview matches fall through to this rule.
  rule {
    priority    = 2147483647
    action      = "allow"
    description = "Allow public website traffic by default"

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}
