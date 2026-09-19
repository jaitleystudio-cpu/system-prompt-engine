# SPE Ω v2.4.1 — G7 ZERO-COST SECURITY / PRIVACY RED-TEAM REPORT

## FINAL VERDICT

SECURITY_PRIVACY_RED_TEAM_VERIFIED_WITHIN_TESTED_SCOPE

## SOURCE CUSTODY

G5 HEAD:
99173c2f700508c6c958b5d79e8bc17418f9bfd6

G6 HEAD (base):
bea709761729f5315d602874f45a06cd49a1f78d

G7 base:
bea709761729f5315d602874f45a06cd49a1f78d

G7 HEAD:
(see source_identity.json after tip pin)

Branch:
cursor/g7zc-security-redteam-0d6e

PR #6:
OPEN @ 4e6c694 — UNTOUCHED / UNMERGED

Contract SHA:
68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3

G2 SHA:
15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562

## ZERO-COST

Provider calls:
0

Required keys:
0

Spend:
₹0

## ATTACK SURFACES (F1–F20)

Privacy (F1–F3, F15):
PASS — USER_PRIVATE omitted/redacted on EXPORT/MODEL; source not mutated; serialized_view free of sentinel secret

Authority (F4–F7):
PASS — ambient authority_state replace blocked; privacy does not mint AuthorityGrant; core compile needs no grant; injection text does not mint authority

.spe trust (F8–F9, F17):
PASS — forged artifact_id rejected (K6_ARTIFACT_ID_MISMATCH); path-independent identity; partial .spe rejected

Credentials / network (F10–F14):
PASS — env secrets not embedded in .spe; credential_presence is boolean; live gate blocked without allow; core survives socket.connect kill; compile.py has no urlopen/requests

Sandbox (F16):
PASS — WRITE_LOCAL_TEMP_FILE traversal outside sandbox_root → REJECTED + SANDBOX_ESCAPE

Injection / Ring-1 boundary (F18–F20):
PASS — forged sentinel escaped in context; injection does not mint qualification; core/compile.py does not import ring1 / AuthorityGrant

## MUTATIONS

G7M1–G7M5:
5 killed · 0 survived

## REGRESSION

Repository-wide pytest:
1023 passed · 0 failed · 0 skipped · exit 0

Denominator:
G6 baseline 998 + 20 G7 red-team + 5 G7 mutations = 1023

compileall spe_runtime:
exit 0

G7 suite alone:
25 passed · 0 failed

## CLAIM BOUNDARY

G1:
BOUND_AND_PASS

G2:
MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE

G3:
DURABLE_RING1_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE

G4:
ZERO_COST_CORE_ENGINE_VERIFIED_WITHIN_TESTED_SCOPE

G5:
ZERO_COST_LOCAL_FAULT_RESILIENCE_VERIFIED_WITHIN_TESTED_SCOPE

G6:
G6_HARNESS_IMPLEMENTATION_PASS / PRODUCT_VALUE_REVIEW_PENDING

G7:
SECURITY_PRIVACY_RED_TEAM_VERIFIED_WITHIN_TESTED_SCOPE

G4X:
OPTIONAL / DEFERRED

Production security certification:
NOT EARNED

Independent professional pentest:
NOT CLAIMED

Malware / all-threat-model coverage:
NOT CLAIMED

World #1:
NOT PROVEN

## EXACT EARNED CLAIM

Within the recorded F1–F20 local adversarial surfaces, the SPE core preserved privacy projection fail-closed behavior, ambient-authority rejection, content-addressed .spe integrity, credential non-embedding, offline compile under network-kill, sandbox path rejection, and injection non-escalation — without paid providers, mandatory network, or PR #6 merge.

## NOT EARNED

PRODUCTION_SECURITY_CERTIFICATION
PENTEST_COMPLETE
MALWARE_SAFE
ALL_THREAT_MODELS
INDEPENDENT_FULL_SYSTEM_REPLICATION
WORLD_1_PROVEN

## FOUNDER DIRECTIVE

Stop gates removed by founder. Continue roadmap after evidence close.

## NEXT

G8-ZC — INDEPENDENT FULL-SYSTEM REPLICATION / CUSTODY PACKAGING

(Founder continue — execute after this PR lands evidence.)

## CONSTRAINTS CARRIED FORWARD

NO PR #6 MERGE.
NO spe_runtime/omega/.
NO paid providers required for zero-cost core path.
NO fabrication of G6 human product-value ratings.
