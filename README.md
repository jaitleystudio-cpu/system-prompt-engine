# system-prompt-engine (SPE)

**Lineage status:** `NEW_IMPLEMENTATION`

This repository is a **fresh start** of the System Prompt Engine implementation.

It is **not** a re-host or continuation claim of the older verified SPE proof lineage (the 181-file / 69-kernel normative tree). That exact source was unavailable at creation time. Work proceeds from S0 onward under this new custody.

## Platform

- Host: GitHub (canonical engineering home)
- Visibility: private
- Default branch: `main`

## Working structure

```
system-prompt-engine/
├── schemas/           # JSON Schemas (xcat_envelope real; others stubs)
├── spe_runtime/       # Runtime packages (xcat kernel first)
├── data/              # Registry + fixture placeholders
├── tests/             # unit / integration / mutation / recovery / security / regression
├── proofs/generated/  # RED/GREEN evidence captures
├── tools/             # Stub CLI helpers
├── docs/              # architecture / implementation / runbooks
├── SPE-SPEC
├── SPE-CHANGELOG
├── pyproject.toml
└── README.md
```

## Dev setup / tests

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/unit/test_xcat_core.py -v
```

## Next

Build from S0. Do not treat this tree as authenticated 181/69 provenance.
