# Causal Proof Graph Ω — Canonical Lineage & Explanation

The **Causal Proof Graph** is SPE's flagship provenance and assurance engine. It provides strict, bidirectional traceability across the entire lifecycle of an AI instruction:

```
[Human Source Span] (PRD / Regulation / Policy)
         ↓
  [ProtectedIntent] (Non-negotiable semantic anchor)
         ↓
   [Requirement] (Atomic verifiable assertion)
         ↓
    [Constraint] (Formal logical boundary)
         ↓
 [XCAT / K3 Transform] (Deterministic compilation rules)
         ↓
  [PromptEffectPlan] (Compiler operation schedule)
         ↓
   [Prompt Clause] (Compiled text emitted to model)
         ↓
     [Test Case] (Verification battery / oracle)
         ↓
  [Runtime Policy] (Capability Firewall authorization grant)
         ↓
  [Failure Record] (Failure Genome Ω counterexample)
         ↓
 [Candidate Repair] (Verified defense clause)
```

---

## 1. Concrete Reference Trace Specification

### Nodes (`evidence/proof-graph/REFERENCE_TRACE.json`)

| Node ID | Type | Description |
|---|---|---|
| `SRC-FIN-01` | `HUMAN_SPAN` | PRD Sec 9.2: Mask cardholder primary account numbers and cap unapproved transfers |
| `INT-FIN-01` | `PROTECTED_INTENT` | PCI-DSS Cardholder Data & Transfer Protection Intent |
| `REQ-FIN-01` | `REQUIREMENT` | Redact PAN numbers in payment assistant and reject unapproved transfers over $10,000 |
| `CON-FIN-01` | `CONSTRAINT` | `payload.pan.masked == true && transfer.limit <= $10,000` |
| `XCAT-FIN-01` | `XCAT_NODE` | `CATEGORY_C08_BUSINESS_FINANCE_GUARD` |
| `K3-FIN-01` | `K3_TRANSFORM` | `K3_PAN_MASK_AND_APPROVAL_RULE` |
| `PLAN-OP-01` | `EFFECT_PLAN_OP` | `INJECT_PAN_MASKING_DIRECTIVE` |
| `CLS-FIN-01` | `PROMPT_CLAUSE` | `You MUST mask all cardholder account numbers (PAN) with asterisks except the last 4 digits, and DENY any wire transfer exceeding $10,000 without dual-approval.` |
| `TST-FIN-01` | `TEST_CASE` | `test_pan_leakage_and_transfer_cap` |
| `POL-FIN-01` | `RUNTIME_POLICY` | `PAYMENT grant requires dual-sign approval token and cardholder masking` |
| `FAIL-FG-01` | `FAILURE_RECORD` | `SPE-FG-2026-000412: Model unmasked card numbers when prompted with markdown table formatting` |
| `REP-FIN-01` | `CANDIDATE_REPAIR` | `DELIMITER_ENFORCEMENT: Enforce regex mask filter before output generation and deny raw payment emission` |

---

## 2. Core Operational Inquiries

### Question 1: "Why does this clause exist?"
Command:
```bash
spe explain CLS-FIN-01
```
Output:
```
💡 CAUSAL PROOF GRAPH EXPLANATION: 'CLS-FIN-01'
  Clause [CLS-FIN-01]: You MUST mask all cardholder account numbers (PAN) with asterisks except the last 4 digits, and DENY any wire transfer exceeding $10,000 without dual-approval.
  Protected Intents:    1
    - [INT-FIN-01] PCI-DSS Cardholder Data & Transfer Protection Intent
  Requirements:         1
    - [REQ-FIN-01] Redact PAN numbers in payment assistant and reject unapproved transfers over $10,000
  Transforms:           3
    - [PLAN-OP-01] INJECT_PAN_MASKING_DIRECTIVE
    - [K3-FIN-01] K3_PAN_MASK_AND_APPROVAL_RULE
    - [XCAT-FIN-01] CATEGORY_C08_BUSINESS_FINANCE_GUARD
  Human Spans:          1
    - [SRC-FIN-01] PRD Sec 9.2: Mask cardholder primary account numbers and cap unapproved transfers
```

### Question 2: "Where is this requirement enforced?"
Command:
```bash
spe trace -r REQ-FIN-01
```
Output:
```
🔍 CAUSAL PROOF GRAPH TRACE: Requirement 'REQ-FIN-01'
  Requirement ID:       REQ-FIN-01
  Constraints:          1
    - [CON-FIN-01] payload.pan.masked == true && transfer.limit <= $10,000
  Prompt Clauses:       1
    - [CLS-FIN-01] You MUST mask all cardholder account numbers (PAN) with asterisks except the last 4 digits, and DENY any wire transfer exceeding $10,000 without dual-approval.
  Test Cases:           1
    - [TST-FIN-01] test_pan_leakage_and_transfer_cap
  Runtime Policies:     1
    - [POL-FIN-01] PAYMENT grant requires dual-sign approval token and cardholder masking
  Covering Tests:       TST-FIN-01
```

### Question 3: "Which transform produced this text?"
Resolved by evaluating upstream `TRANSFORMS` edges:
- `K3-FIN-01` (`K3_PAN_MASK_AND_APPROVAL_RULE`) and `PLAN-OP-01` (`INJECT_PAN_MASKING_DIRECTIVE`).

### Question 4: "Which tests cover this requirement?"
Resolved by forward tracing `VALIDATES_WITH` edges:
- `TST-FIN-01` (`test_pan_leakage_and_transfer_cap`), backed by empirical local evidence receipt `EV-PAN-01` (`OBSERVED_LOCAL`, pass rate 100%).

### Question 5: "Which failures affect it and what repairs exist?"
Resolved by querying `REGRESSED_BY` and `REPAIRS` edges:
- Regressed by `FAIL-FG-01` (`SPE-FG-2026-000412`).
- Repaired by `REP-FIN-01` (`DELIMITER_ENFORCEMENT: Enforce regex mask filter`).
