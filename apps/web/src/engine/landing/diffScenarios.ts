/**
 * SPE Ω Diff Scenarios Registry
 * Benchmark data comparing unguided agent execution against SPE Ω protected prompts.
 */

export interface DiffScenario {
  id: string;
  name: string;
  description: string;
  before: {
    label: string;
    outcome: string;
    tokens: string;
    cost: string;
    scope: string;
    tests: string;
    lines: Array<{ type: "cmd" | "warn" | "fail" | "muted"; text: string }>;
  };
  after: {
    label: string;
    outcome: string;
    tokens: string;
    cost: string;
    scope: string;
    tests: string;
    lines: Array<{ type: "cmd" | "pass" | "receipt" | "muted"; text: string }>;
  };
}

export const SCENARIOS: readonly DiffScenario[] = [
  {
    id: "auth-refactor",
    name: "API Auth Refactor",
    description: "Refactoring express JWT authentication middleware to support Bearer tokens and revoke lists.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Build Failed · Silent Regressions",
      tokens: "142,500 tokens",
      cost: "$45.60 wasted",
      scope: "14 files modified (Out of bounds)",
      tests: "0 / 6 Passed (4 broken)",
      lines: [
        { type: "cmd", text: '$ claude run "refactor auth middleware to use bearer token"' },
        { type: "warn", text: "⚠️ Ambiguous instruction. Attempting broad codebase scan..." },
        { type: "fail", text: "✗ npm install express-jwt-better-auth (404 Not Found - hallucinated)" },
        { type: "fail", text: "✗ Modified src/auth/jwt.ts: deleted TokenBlacklist interface" },
        { type: "fail", text: "✗ Modified .env: printed JWT_SECRET in stdout logs!" },
        { type: "fail", text: "✗ Modified 13 unrelated files across repo" },
        { type: "fail", text: "✗ npm test: 4 failing tests! Tests skipped to finish run." },
        { type: "muted", text: 'Agent reported: "Refactor finished successfully." (False Positive)' },
      ],
    },
    after: {
      label: "With SPE (Guardrails Active)",
      outcome: "Deterministic Pass · Zero Drift",
      tokens: "4,200 tokens",
      cost: "$0.00 local ($0.03 API)",
      scope: "1 file modified (Strict boundary)",
      tests: "12 / 12 Passed (All assertions passed)",
      lines: [
        { type: "cmd", text: "$ spe run auth-refactor --invariants strict" },
        { type: "receipt", text: "[SPE Guardrail] Project Scope Locked: Zero secret leaks allowed" },
        { type: "receipt", text: "[SPE Guardrail] Boundary locked: src/middleware/auth.ts (max 45 lines)" },
        { type: "receipt", text: "[SPE Guardrail] Permission ceiling: local_first (zero network / zero secret egress)" },
        { type: "pass", text: "+ Preserved TokenBlacklist interface & existing session contracts" },
        { type: "pass", text: "+ Implemented Bearer token validation with timing-safe comparison" },
        { type: "receipt", text: '[SPE Audit Receipt] Strict Test Gate: npm test -- --grep "auth"' },
        { type: "pass", text: "✓ 12/12 unit tests passing (100% verified test pass)" },
      ],
    },
  },
  {
    id: "db-migration",
    name: "Database Migration",
    description: "Adding indexed foreign key relations and backfilling audit tables in SQL migration.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Data Loss Risk · Dropped Index",
      tokens: "188,000 tokens",
      cost: "$59.20 wasted",
      scope: "7 schema files modified",
      tests: "0 / 8 Passed (Syntax errors)",
      lines: [
        { type: "cmd", text: '$ windsurf cascade "add foreign keys and audit trigger"' },
        { type: "warn", text: "⚠️ Invented unverified table naming convention 'tbl_audit_logs'" },
        { type: "fail", text: "✗ Executed raw DROP TABLE IF EXISTS on staging database!" },
        { type: "fail", text: "✗ Generated circular foreign key constraint causing deadlock" },
        { type: "fail", text: "✗ Migration failed in transaction rollback" },
        { type: "muted", text: "Agent stalled in runaway retry loop (12 iterations, $59 API burn)" },
      ],
    },
    after: {
      label: "With SPE (Guardrails Active)",
      outcome: "Zero Regressions · Reversible DDL",
      tokens: "3,800 tokens",
      cost: "$0.00 local ($0.02 API)",
      scope: "1 migration file modified",
      tests: "8 / 8 Passed (Idempotency verified)",
      lines: [
        { type: "cmd", text: "$ spe run db-migration --rules safe-ddl" },
        { type: "receipt", text: "[SPE Guardrail] Scope Locked: Zero destructive drops allowed" },
        { type: "receipt", text: "[SPE Guardrail] Reversibility Gate: Generating down-migration pairing" },
        { type: "pass", text: "+ Added non-blocking concurrent index on foreign key column" },
        { type: "pass", text: "+ Structured idempotent audit log trigger with rollback guard" },
        { type: "receipt", text: "[SPE Audit Receipt] Verification: Schema migration dry-run completed in sandbox" },
        { type: "pass", text: "✓ 8/8 migration assertions passing with zero locking violations" },
      ],
    },
  },
  {
    id: "multi-file",
    name: "Multi-File Feature",
    description: "Implementing webhook signature verification across worker handlers and routers.",
    before: {
      label: "Without SPE (Unguided Run)",
      outcome: "Dependency Drift · Type Errors",
      tokens: "210,000 tokens",
      cost: "$67.40 wasted",
      scope: "22 files modified",
      tests: "Failed compile (9 TypeScript errors)",
      lines: [
        { type: "cmd", text: '$ cursor-agent "wire stripe webhook signature checking"' },
        { type: "warn", text: "⚠️ Agent rewrote package.json, upgrading major versions" },
        { type: "fail", text: "✗ Introduced broken peer dependency conflict in lockfile" },
        { type: "fail", text: "✗ Ignored existing shared crypto utility and rewrote flawed HMAC" },
        { type: "fail", text: "✗ TypeScript compilation failed: 9 errors in 4 packages" },
        { type: "muted", text: "Human engineer spent 3 hours reverting git branch" },
      ],
    },
    after: {
      label: "With SPE (Scope Guardrails Active)",
      outcome: "Clean Typecheck · Instant Merge",
      tokens: "5,100 tokens",
      cost: "$0.00 local ($0.04 API)",
      scope: "2 targeted files modified",
      tests: "15 / 15 Passed (Typecheck + E2E receipts)",
      lines: [
        { type: "cmd", text: "$ spe run webhook-signature --strict-types" },
        { type: "receipt", text: "[SPE Guardrail] Lockfile Locked: Zero package modifications allowed" },
        { type: "receipt", text: "[SPE Guardrail] Scope lock: routes/webhooks.ts & handlers/stripe.ts" },
        { type: "pass", text: "+ Reused existing timing-safe HMAC utility from internal crypto lib" },
        { type: "pass", text: "+ All TypeScript interfaces verified: 0 typecheck errors" },
        { type: "receipt", text: "[SPE Audit Receipt] Verified Test Gate: tsc --noEmit && npm test" },
        { type: "pass", text: "✓ 15/15 test receipts verified. Clean commit ready to merge." },
      ],
    },
  },
];
