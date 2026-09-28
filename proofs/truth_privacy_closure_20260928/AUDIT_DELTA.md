# MASTER AUDIT DELTA (affected IDs only)

| ID | Topic | OLD STATUS | NEW STATUS | EVIDENCE | REMAINING GAP |
|---|---|---|---|---|---|
| 58 | URL | Overclaim vs CSP | CLOSED | URL_CSP_CLOSURE.md; `url_reference_only` | Same-origin fetch still possible when allowed |
| 59 | Website input | Misleading contact claim | CLOSED | Privacy + composer URL copy | — |
| 70–85 | URL intelligence/trust (as affected) | Partial / CSP conflict | HONEST_REFERENCE | `urlIngest.ts` policy + tests | Remote HTML acquisition not offered under CSP |
| 103 | No silent truncation | FAIL (Home maxLength) | CLOSED | INPUT_LIMITS.md; home-bound browser | Create still bounded; Massive Intent out of scope |
| 143 | Network denied by default | Present but copy conflict | CLOSED | CSP + egress audit + privacy wording | Optional same-origin assets remain |
| 196–202 | Screenshot/code claims | Risk of compiler overclaim | TRUTHFUL | SCREENSHOT_CODE_CLAIMS.md | Not a target runtime (intentional) |
| 225–236 | Privacy rows | Mixed absolute wording risk | ALIGNED | PRIVACY_MATRIX.md | Browser speech vendor path outside SPE control |
| 251 | URL hostile-content isolation | Present | PRESERVED | UNTRUSTED_SOURCE wrap retained | — |

Unrelated Master Audit rows: **unchanged / not re-run**.
