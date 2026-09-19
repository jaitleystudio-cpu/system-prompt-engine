# G5-FREEZE — Qualification packaging

This directory freezes SPE Ω v2.4.1 at qualification HEAD `99173c2` as a reproducible baseline.

| File | Role |
|------|------|
| `source_identity.json` | HEAD, contract/G2 SHAs, PR #6, zero-cost |
| `QUALIFICATION_MANIFEST.json` | Canonical G1–G5 + evidence + claims |
| `QUALIFICATION_MANIFEST.sha256` | Deterministic SHA-256 of the manifest |
| `INTEGRITY.json` | Pointer integrity wrapper |
| `QUALIFIED_BASELINE.md` | Release boundary (human) |

Verify without re-running tests:

```bash
python tools/verify_g5_checkpoint.py
python tools/verify_g5_checkpoint.py --require-tag
python tools/verify_g5_checkpoint.py --check-pr6-live
```
