# Workflow Export V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a versioned offline export contract that turns an SPE artifact or prompt contract into a portable n8n, Make, Zapier, or generic workflow document without sending, storing credentials, or executing anything.

**Architecture:** Extract a canonical prompt contract, project it into a target document, and attach a closed fidelity ledger. Every facet is `PRESERVED`, `DEGRADED`, or `UNSUPPORTED`. The canonical section always carries the value (or an explicit withhold). Target documents never contain webhook nodes, credentials, or runnable flags. `loss_state` is derived only from the ledger.

**Tech Stack:** Python 3.11 stdlib plus existing `jsonschema`. No new dependencies.

## Global Constraints

- BASE_SHA `bd4540a9c96801168f2e7363c001a4184bad4311`
- Branch `grok/spe-workflow-export-v1-20260930`
- I1 runtime, WASM pin, PR #71, `spe_runtime/xcat/**`, `spe_runtime/k3/**`, `spe_runtime/quality/**`, `portable/spe-core-rs/**` are untouched
- Export only: no network, no credentials, no webhook trigger, no publish, no execution
- ₹0 new paid dependencies
- Capability is not authority; validation is not execution
- Silent omission is a defect: a facet the target cannot keep is `DEGRADED` or `UNSUPPORTED` with a warning
- Original tests stay as they are; new tests land first

---

### Task 1: Contract tests

**Files:**
- Create: `tests/unit/test_workflow_export_v1.py`
- Create: `schemas/workflow_export.schema.json`
- Create: `spe_runtime/workflow_export/`

**Interfaces:**
- Consumes: a mapping that is either an SPE artifact (`spe_format` starting with `spe.artifact.`) or `spe.prompt-contract.v1`
- Produces: `export_workflow(source, *, target) -> dict` with `export_contract_version == "spe.workflow-export.v1"`

Facets, always all six: `prompt_body`, `variables`, `required_inputs`, `expected_outputs`, `constraints`, `provider_target`.

Target policy when nothing is stripped:

- `generic_json` and `generic_text`: all six `PRESERVED`, `loss_state` `NONE`
- `n8n`: `prompt_body` and `variables` `PRESERVED`; the other four `DEGRADED`; workflow `active` false; only a sticky-note node
- `make`: all six `DEGRADED`; `flow` empty; no connections
- `zapier`: `required_inputs` and `expected_outputs` `UNSUPPORTED`; the other four `DEGRADED`; `importable` false; `runnable` false; `loss_state` `UNSUPPORTED`

- [x] **Step 1: Write the failing test** covering preservation, degradation, secrets, artifact non-mutation, and ledger mutations
- [x] **Step 2: Run** `python -m pytest tests/unit/test_workflow_export_v1.py -q` and confirm failure because the package is missing
- [x] **Step 3: Implement** the extractor, projections, schema, and `audit_export`
- [x] **Step 4: Re-run the same test** and confirm pass
- [x] **Step 5: Commit**

### Task 2: Review and fresh verification

- [x] Independent read-only review of the branch diff against this plan
- [x] Fix important defects
- [x] Re-run the new test file on the committed tree before any PASS claim
