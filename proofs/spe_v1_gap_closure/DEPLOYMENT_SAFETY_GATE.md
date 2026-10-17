# Deployment safety gate (FAIL CLOSED)

**HOSTING=FORBIDDEN.** This gate does not deploy.
**WORLD#1=NOT_PROVEN.**

| Requirement | Status | Detail |
|---|---|---|
| ddos_protection | **FAIL** | Requires SPE_DDOS_PROTECTION_PROVEN=1 with provider evidence |
| bandwidth_spend_ceiling | **FAIL** | Requires SPE_BANDWIDTH_CEILING_PROVEN=1 hard cap evidence |
| tls | **FAIL** | Requires SPE_TLS_PROVEN=1 for apex HTTPS |
| security_headers_artifact | PASS | apps/web/public/_headers present with CSP/frame-ancestors/nosniff |
| security_headers_live | **FAIL** | Requires SPE_SECURITY_HEADERS_PROVEN=1 live response proof |
| cache_policy | **FAIL** | Requires SPE_CACHE_POLICY_PROVEN=1 (shell vs immutable assets) |
| abuse_protection | **FAIL** | Requires SPE_ABUSE_PROTECTION_PROVEN=1 (rate limits / WAF) |
| no_unlimited_billing | **FAIL** | Requires SPE_NO_UNLIMITED_BILLING_PROVEN=1 spend ceiling |
| founder_unlock | **FAIL** | Requires SPE_FOUNDER_HOSTING_UNLOCK=1 — default FORBIDDEN |

Gate result: **FAIL CLOSED** (8 unmet). Do not host.
