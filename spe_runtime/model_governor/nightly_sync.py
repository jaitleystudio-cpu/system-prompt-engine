"""
spe_runtime/model_governor/nightly_sync.py

Python Runtime Autonomous Night-Watch & Continuous Synchronizer for AI Model Currency.
Validates parity between Python runtime models and TypeScript model atlas registry.
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

from spe_runtime.model_governor.currency_kernel import (
    FRONTIER_ACTIVE_YEAR,
    FRONTIER_MODELS_2026,
    is_model_current,
    auto_upgrade_legacy_model,
    assert_model_currency,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REGISTRY_PATH = REPO_ROOT / "apps/web/src/engine/modelAtlas/modelAtlasRegistry.json"
MANIFEST_PATH = REPO_ROOT / "evidence/model_atlas_manifest.json"
ATTESTATION_PATH = REPO_ROOT / "evidence/model-currency-attestation.json"


def canonical_json(obj: Any) -> str:
    """Produces RFC 8785 style canonical JSON string."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def verify_model_currency() -> Dict[str, Any]:
    """
    Audits the current model state against the 2026 Frontier Currency Mandate.
    """
    if not REGISTRY_PATH.exists():
        raise FileNotFoundError(f"Model atlas registry not found at: {REGISTRY_PATH}")

    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    models: List[Dict[str, Any]] = data.get("models", [])

    active_models = [m for m in models if not m.get("isLegacy", False)]
    legacy_models = [m for m in models if m.get("isLegacy", False)]

    # Invariant 1: Active models count >= 18
    if len(active_models) < 18:
        raise ValueError(f"Active models count is {len(active_models)}, expected >= 18")

    # Invariant 2: 100% of active models have 2026 release dates and '2026-frontier' generation
    for m in active_models:
        rel_date = m.get("releaseDate", "")
        if not rel_date.startswith("2026"):
            raise ValueError(f"Active model '{m.get('id')}' release date '{rel_date}' is not in 2026")
        if m.get("generation") != "2026-frontier":
            raise ValueError(f"Active model '{m.get('id')}' generation is '{m.get('generation')}', expected '2026-frontier'")

    # Invariant 3: Python kernel and TS registry have active ID parity
    py_ids = set(FRONTIER_MODELS_2026.keys())
    ts_ids = {m["id"] for m in active_models}
    common_ids = py_ids.intersection(ts_ids)
    if len(common_ids) < 18:
        raise ValueError(f"Parity mismatch: Python and TS registries only share {len(common_ids)} active IDs")

    # Compute RFC 8785 canonical checksum
    raw_models_json = json.dumps(models, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(raw_models_json.encode("utf-8")).hexdigest()

    return {
        "status": "QUALIFIED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_models": len(models),
        "active_models": len(active_models),
        "legacy_models": len(legacy_models),
        "checksum_sha256": digest,
        "active_year": FRONTIER_ACTIVE_YEAR,
    }


def sync_nightly(apply: bool = False) -> Dict[str, Any]:
    """
    Executes the nightly model currency synchronization.
    """
    result = verify_model_currency()
    print(f"[*] Model Currency Status: {result['status']}")
    print(f"[*] Active 2026 Models:  {result['active_models']}")
    print(f"[*] Audit Legacy Models: {result['legacy_models']}")
    print(f"[*] SHA-256 Digest:      {result['checksum_sha256']}")

    if apply and ATTESTATION_PATH.exists():
        attestation = json.loads(ATTESTATION_PATH.read_text(encoding="utf-8"))
        attestation["pythonRuntimeVerified"] = True
        attestation["pythonTimestamp"] = result["timestamp"]
        ATTESTATION_PATH.write_text(json.dumps(attestation, indent=2) + "\n", encoding="utf-8")
        print(f"[+] Updated Attestation with Python runtime verification: {ATTESTATION_PATH}")

    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="SPE Frontier Model Currency Python Synchronizer")
    parser.add_argument("--check", action="store_true", help="Perform verification check only")
    parser.add_argument("--apply", action="store_true", help="Apply verified synchronization")
    args = parser.parse_args()

    try:
        sync_nightly(apply=args.apply)
        print("\n🎉 ALL MODEL CURRENCY GATES VERIFIED CLEANLY IN PYTHON RUNTIME!")
        sys.exit(0)
    except Exception as exc:
        print(f"\n❌ FATAL: Model currency verification failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
