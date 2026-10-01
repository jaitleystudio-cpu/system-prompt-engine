# A9-Q Authority Hub browser and schema QA

FINAL: `HOLD_STUB_SCHEMAS_SILENT_GRANT_FALSE_BADGE_PUBLISH_COPY`

MERGED=NO
DEPLOYED=NO
HOSTED=NO

Checkout: `8f6a7870290891020efcc3fde8e9d98a548d4365`. Evidence only under `proofs/a9_q_authority_hub_qa/`. Product schemas, Authority Hub UI, I1, I2, and WASM were not modified. Local browser QA used Vite on `127.0.0.1:5173` only.

No control labeled Publish, Share, Deploy, or Host was found on `/`, `/create`, `/capabilities`, `/daily-lab`, `/privacy`, or `/workspace`.

A well-typed envelope (`status: GRANTED`, `level: 2`, `grants: ["PUBLISH"]`, `execution_grants: ["HOST"]`) fails `authority-not-escalated`. The defects below are the paths that still accept publication, drop grants, or show a contradictory authority badge.

## Defects

### D1 — stub authority schema accepts publication

Path: `schemas/authority_state.schema.json`

Evidence: `proofs/a9_q_authority_hub_qa/schema_attack_results.json` case `authority_state_stub_accepts_publish_object` and `authority_state_stub_accepts_empty_object` both have `errors: []`. The instance includes `status: GRANTED`, `level: 9`, grants `PUBLISH` / `HOST` / `DEPLOY` / `PUBLIC_SHARE`, `capability: EXECUTE`, and `validation_is_execution: true`. The schema is `additionalProperties: true` and does not separate capability from authority.

### D2 — stub execution-grant schema accepts publication and an empty grant

Path: `schemas/execution_grant.schema.json`

Evidence: `execution_grant_stub_accepts_publish_object` and `execution_grant_stub_accepts_empty_object` both have `errors: []`. An empty object validates. That drifts from `spe_runtime/authority/models.py` `AuthorityGrant`, which requires grant identity, principal, capability, target, and revocation state.

### D3 — stub capability manifest conflates capability, authority, and execution

Path: `schemas/capability_manifest.schema.json`

Evidence: `capability_manifest_stub_accepts_authority_and_publish` has `errors: []` for a payload with `capabilities`, `authority: GRANTED`, `execution_grants: ["PUBLISH"]`, `publish` / `host` / `deploy` / `public_share`, and `validation_is_execution: true`.

### D4 — envelope schema and runtime validator allow smuggled publish on NONE

Path: `schemas/xcat_envelope.schema.json` (`authority_state` and `execution_grants` items are `additionalProperties: true`)

Evidence: `xcat_envelope_accepts_smuggled_publish_on_none_authority` has schema `errors: []` and `runtime_validator_errors: []` via `spe_runtime.xcat.validator.validate_envelope_dict`. The accepted envelope keeps `status: NONE` and `level: 0` while adding `capability: PUBLISH`, `publish`, `host`, `deploy`, `public_share`, and `validation_is_execution`. The grant item `g-publish` includes `scope: public_share`, `capability: PUBLISH`, `executed: true`, and `silent_escalation: true`.

### D5 — provider profile schema drift and read_ prefix bypass

Path: `schemas/provider_profile.schema.json` (`authority_capabilities` is an unconstrained string array)

Evidence: `provider_profile_schema_accepts_publish_host_deploy_share` and `provider_profile_schema_accepts_read_publish_prefix` both have `errors: []`. Python `_check_authority_flags` / `validate_provider_profile` reject bare `publish`, `host`, `deploy`, and `public_share`, and accept `read_publish`, `read_host`, and `read_public_share`. `FORBIDDEN_AUTHORITY_FLAGS` lists escalate/mint/grant/execute/admin and omits the publish family. The shipped `data/provider_profiles_v1.json` DETERMINISTIC profile uses `["read_status"]` and is not itself a publish grant.

### D6 — silent grant drop with a PASS badge

Path: `packages/web-runtime/src/executionRecord.ts` (`strings` returns `[]` for non-arrays; non-numeric `level` becomes `0`; extra keys are ignored; `authoritySafe` only checks coerced status, level, and grant arrays)

Evidence: `proofs/a9_q_authority_hub_qa/runtime_attack_results.json`. Input envelope `authority_state` is `{ status: "NONE", level: "9", grants: "PUBLISH", capability: "EXECUTE", publish/host/deploy/public_share/validation_is_execution: true }` and `execution_grants` is `"PUBLIC_SHARE"`. Displayed contract authority is `{ status: "NONE", level: 0, grants: [], execution_grants: [] }`. Check `authority-not-escalated` is `PASS` with detail `Authority is NONE; no grants or side-effect permission were created.` Round-trip `privacy.authority` stays `GRANTED`. Fixture: `proofs/a9_q_authority_hub_qa/fixtures/smuggled-authority.spe.json`.

Browser import of that fixture on `http://127.0.0.1:5173/workspace` (`browser_qa_results.json`):

- Pill text: `authority: GRANTED`
- Authority card: `STATUS NONE`, `LEVEL 0`, `GRANTS 0`, `SIDE EFFECTS NONE`
- Check line: `Authority not escalated` / `Authority is NONE; no grants or side-effect permission were created.` / `PASS`
- Simple presentation: `No authority granted` and `No side effects authorized` with `data-ok="true"`

### D7 — false authority and execution badges

Paths:

- `apps/web/src/ui/PrivacyIndicator.tsx` renders `authority: {value}` from the envelope privacy field
- `apps/web/src/App.tsx` `privacyFromEnvelope` reads `privacy.authority`, not `authority_state`
- `apps/web/src/workspace/ExecutionContractPanel.tsx` hardcodes inspect `Side effects` to `NONE` and `Executed` to `NO`. Simple `sideEffectsNone` is true when `record.executed === false` even if `side_effects` is not `NONE`

Evidence:

- Browser pill vs card in D6, screenshots `/opt/cursor/artifacts/a9q-authority-pill.png` and `/opt/cursor/artifacts/a9q-authority-card.png`
- Simple badge screenshot `/opt/cursor/artifacts/a9q-simple-false-badge.png`
- Isolated render `fixtures/inspect-lying-record.html`: record `executed: true`, `side_effects: "PUBLIC_SHARE"` still shows authority `Side effects` `NONE` and `Executed` `NO`, while the local run record prints `Side effects` `PUBLIC_SHARE`
- Isolated render `fixtures/simple-false-badge.html`: `executed: false`, `side_effects: "PUBLISH"` still shows `No side effects authorized` and `data-ok="true"`

The live builder forces `executed: false` and `side_effects: "NONE"`, so the import path does not display `PUBLIC_SHARE` in the run record. The component still paints those fields independently of the record.

### D8 — Daily Lab publication copy

Paths: `apps/web/src/lab/DailyLab.tsx`, `apps/web/src/lab/specimens.ts`

Evidence: browser `lab_meta` is `PUBLISH DATE / 2026-09-16 / STATUS / published`. Queue items use `status: "published"`. Screenshot `/opt/cursor/artifacts/a9q-daily-lab-publish.png` (desktop) and `/opt/cursor/artifacts/a9q-daily-lab-mobile.png`.

### D9 — public host routes and crawl files

Paths:

- `apps/web/src/routing.ts` comment `History-based public routes` and `SITE = "https://systempromptengine.com"`
- `apps/web/src/ui/SeoHead.tsx` writes canonical and `og:url` from that host
- `apps/web/public/robots.txt` `Allow: /` and `Sitemap: https://systempromptengine.com/sitemap.xml` (comment says hosting remains founder-gated)
- `apps/web/public/sitemap.xml` lists the public origin for `/`, `/create`, `/code`, `/daily-lab`, `/capabilities`, `/my-work`, `/privacy`
- `apps/web/public/_headers` sets `Cache-Control: public, max-age=31536000, immutable` on `/spe_wasm.wasm` and `/assets/*`

Evidence: every local route visited wrote a canonical and `og:url` of `https://systempromptengine.com` plus the path (`browser_qa_results.json`).

## Held laws that did not fail this pass

- Typed grant escalation fails `authority-not-escalated` (`runtime_attack_results.json` `typed_grant_check: FAIL`).
- Capabilities copy states that selecting a provider profile is not an authority grant (`apps/web/src/pages/Capabilities.tsx`).
- `spe_runtime/categories/c07_execute/engine.py` forms an intent and does not mint grants; this QA did not change that tree.
- No merge, deploy, or public host was performed.
