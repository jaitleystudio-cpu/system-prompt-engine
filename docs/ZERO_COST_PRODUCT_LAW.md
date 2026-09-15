# Zero-Cost Product Law

Owner target: **₹0 owner spend** for core SPE development and conformance.

## Hard rules

1. **FREE core** — the SPE core library and universal ABI remain free to build and run locally.
2. **₹0 owner spend target** — no paid cloud, no paid model APIs, no paid analytics, no paid CI extras required for Sprint proofs.
3. **No prompt sales** — SPE does not sell prompts or treat prompts as a monetized SKU in core.
4. **No ad targeting** — core must not include advertising SDKs or user-targeting ad pipelines.
5. **Dependencies** — `pyproject.toml` stays free: `jsonschema` (+ `pytest` for dev) unless a free local dep is truly required.
6. **Sprint 4 network** — validation and conformance run with `network_mode=NONE`.

## Allowed

- Local Python, local fixtures, local tempfile adapters already in-tree
- Free/open dependencies already declared
- Documentation and conformance JSONL

## Forbidden cost vectors

| Vector | Allowed? |
| --- | --- |
| Paid package registry deps for core | NO |
| Paid API keys (LLM, search, billing) | NO |
| Hosting / SaaS required for proofs | NO |
| Prompt marketplace in core | NO |
| Ad targeting / telemetry sales | NO |

## Proof posture

Sprint proofs must remain reproducible offline on a clean checkout with `python -m pytest`.
