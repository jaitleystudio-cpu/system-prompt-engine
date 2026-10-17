# SPE Pro Studio r3 — build spec

Status: build spec for branch `grok/pro-studio-r3`. Not deployed. Hosting is on HOLD. Payments are not live.
Nothing here is a measured result; results live in the test outputs and the progress log.

## 0. Fixed rules
- SPE pays $0 for model inference. Every model call uses the customer's own provider key (BYOK), sent per
  request in `X-Provider-Key`, never stored, never logged, never echoed.
- Pro is paid-only and online-only. No account login. A Pro access key (`spe_pro.v1.*`, Ed25519) is verified
  by the server on every request. Tools run on the server; the browser renders results.
- No local/offline Pro features. No free Pro features.
- No "#1", "10/10", "flawless", "first in world", AGI or invented model names in UI copy.
- UNKNOWN / SKIPPED / SIMULATED / NOT_RUN / UNPROVEN never count as PASS.
- builder != verifier: the code that writes prompts (`living/compile.ts`, `living/loop.ts`) never decides
  PASS. Only `living/verify.ts` does, and certificates are re-verified from stored output by the server.

## 1. r2 defects to fix first
1. `tsc --noEmit` fails: 2 errors (keys.ts BufferSource typing; ProStudioApp imports missing `accessFrom`).
2. Tools import `core/*` and run in the browser. Fix: every tool calls `/api/pro/*`; client code may only
   import `shared/*` and `import type` from core. Enforced by an import-graph test and a built-bundle grep.
3. ProStudioApp uses the old local trial/licence check. Fix: the gate is `GET /api/pro/session` only.
4. (found) `pro-studio.css` is imported but was never committed; `proApiPlugin` is imported but not registered.

## 2. Server
- `handleProRequest(req, env, deps)` — Web-standard. deps: `keyEnv`, `store`, `fetch`, `now`, `random`.
- Storage: `ProStore` interface. `MemoryStore` (dev/tests; NOT persistent) and `KvStore` (Cloudflare KV
  binding `PRO_KV`, free tier). No store is provisioned; the choice is Prawin's. Data keyed by key `sub`.
- Rate limit: fixed window per `sub` in the store. Defaults (proposal, Prawin to decide): 120 req/min,
  BYOK routes 20 req/min. 429 with `retry-after`.
- Providers (BYOK): `openai`, `anthropic`, and OpenAI-compatible hosts on an allowlist (Groq, OpenRouter,
  Google Gemini OpenAI-compatible endpoint, Mistral) so customers can use no-card free tiers. Custom URLs
  outside the allowlist are rejected (SSRF guard). Provider `mock` exists only when
  `SPE_PRO_ALLOW_MOCK_PROVIDER=1` AND the request uses a test key; its results are labelled SIMULATED.
- Every provider error becomes 502 `PROVIDER_ERROR` with the status code only; the key never appears.

## 3. Living .spe project (flagship)
A persistent project stored on the server:
- `intent` (goal text), `inputs` (test inputs: text + optional category + language).
- `requirements[]` — protected. Each has `id`, `text`, `check`. Check kinds (deterministic):
  `contains`, `not_contains`, `regex`, `not_regex`, `json_valid`, `json_keys`, `max_words`, `min_words`,
  `max_chars`, `starts_with`, `ends_with`, `line_count_max`. Kind `manual` has no automatic check; its
  status is always UNPROVEN until a human marks it (human marks are labelled HUMAN, not VERIFIED).
- Protected-intent firewall: every compiled prompt must carry every requirement clause. A prompt version
  that drops or alters one FAILS (`INTENT_LOSS`) and is never sent to a model.
- `budget`: `maxAttempts` (1–12), `maxTokens` (provider-reported where available, else estimated and
  labelled ESTIMATED). Server enforces both.
- `ledger`: per requirement per input — VERIFIED / FAILED / UNPROVEN / NOT_RUN, with the attempt id and a
  SHA-256 of the evidence output.
- `attempts[]`: prompt, strategy, repairs, per-input outputs (truncated, hashed), check results, diagnosis,
  decision, usage, provider, model, time.
- `status`: draft | running | verified | paused | stopped.

Loop (one server request = one attempt, so the browser can Stop between attempts and every request is
bounded): compile prompt → firewall → run on customer model for each input → verify (deterministic) →
diagnose → decide:
- all requirements VERIFIED on all inputs, none UNPROVEN-blocking → `verified` + certificate.
- E0 Repair: add a targeted repair clause for each failing requirement (same strategy).
- E1 Adaptation: if the same deficit persists after 2 consecutive repairs, switch strategy
  (direct → checklist → format-first → decompose).
- caps reached / user Stop / 2 consecutive provider errors → honest pause with a receipt that lists what is
  verified, what failed, what is unproven, attempts used, tokens used, and why it stopped.
- The model saying "done" is never evidence. Only checks are.
- E2 (transition) is design-only and out of scope.

## 4. Proof certificate
Per verified (or paused) result: project id, attempt, provider, model (as typed by the customer), SPE
version, prompt SHA-256, output SHA-256s, every test run with status, verdict, `builder` id, `verifier` id,
issued time, certificate SHA-256, and an Ed25519 signature when `SPE_PRO_RELEASE_JWK` is configured
(otherwise marked UNSIGNED). `POST /certificate/verify` re-runs the verifier on the stored outputs; any
edit to the certificate or outputs fails.

## 5. Evaluation extras
- Blind A/B: two prompts, the same inputs, run on the customer's model. Server assigns X/Y with
  crypto-random order per case and keeps the mapping; the browser gets only X/Y until the human submits
  picks; then the server reveals. Deterministic check results are reported separately from human picks.
- Breakdowns: every multi-input report groups by category and language with n, pass, fail, unproven;
  groups with n < 5 are flagged "small sample"; the worst group is shown first. No average without groups.
- Cross-model portability: one prompt + requirements + inputs on up to 4 customer models; per-model rows;
  a model with no key is NOT_RUN.

## 6. Tests
Unit (keys, core, living verify/compile/diagnose/loop, certificate, breakdown, blind A/B, store, rate
limit, providers), API integration (401 without key / tampered key / test key disabled, 200 with test key,
body cap, BYOK with mocked fetch, key never in responses), negative tests, mutation checks (flip expiry,
skip signature, skip revocation, test keys without flag, firewall off, verifier trusts "done"), client
import-graph test, built-bundle grep, Playwright e2e + screenshots at 1440/1280/390.

## 7. Flagship acceptance: crash → captured error → Prompt V2 → 0 errors

Flow (Prawin's diagram, shown as the Living timeline): goal → Prompt V1 compiled → model writes code →
code executed → error captured → Intent Loss Shield → Prompt V2 (scoped repair) → re-executed →
**Verified 0 errors, fix recorded**. The last step never says "Deployed".

- Check kind `runs_clean` (`env: "browser" | "ssr"`). The verifier reads the recorded execution evidence
  (`Run.exec`). No execution → `NOT_RUN`. Errors or console errors → `FAILED` with the captured error.
- No sandbox configured (e.g. Workers today) → the loop pauses with `NO_SANDBOX`. It never guesses.
- Sandbox: `pro-api/sandbox-node.ts` (worker thread, empty env, 64 MB, 3 s wall kill, `vm` with a fake DOM or
  SSR context with no `window`/`document`). Not a security boundary. A production sandbox is still to be chosen.
- Scoped repair guard (`core/living/scope.ts`):
  1. ProtectedIntent frozen (`FREEZE_RULE`).
  2. Failing call site pinned (line, column, expression) from the stack or by name search.
  3. Error-class constraints (undefined reference, wrong import, conditional hooks, browser globals in SSR,
     TypeError on undefined, SyntaxError) plus `SCOPE_RULE`: must not touch UI, layout, styling or libraries;
     change only the broken expression; keep all props.
  4. After V2, the drift is checked, not assumed: an LCS line diff V1→V2. The attempt is `REJECTED_DRIFT` when
     lines change outside the pinned region beyond the allowance, imports change, styling changes, a declared
     feature disappears, or a check that passed before now fails. The receipt records diff size, touched regions
     and the preserved-feature results. The certificate recomputes the drift verdict, so tampering is detected.
- Intent Loss Detector (`src/engine/intentLossDetector`) runs on every compiled prompt through
  `core/living/intentShield.ts`. A CRITICAL finding (for example, a dropped negative constraint) blocks the attempt
  before the model is called.
- Evidence: SIMULATED model output (the dev mock provider) is labelled SIMULATED in the receipt and UI. Sandbox
  execution, checks, diffs, receipts and certificates are real computation.
- Tests (deterministic mock: crash first, fix second): `flagship.test.ts`, `scope.test.ts`, e2e
  `scripts/e2e-pro-studio.mjs`. Negative tests: V2 still crashes → retries up to the cap → `PAUSED BUDGET_ATTEMPTS`
  with a receipt, never VERIFIED. A 200-line rewrite, a dropped feature, a style change, a library swap, or a
  regression → `REJECTED_DRIFT`.
- Unverified figures found in the repo (the "41% constraints dropped" claim, whose cited arXiv id is unrelated;
  the antiDrift "-60%/-40%" claim; the refiner "4.8x" claim) are not used in any Pro Studio copy.
