"""SPE Package Specification v0.1: Deterministic canonical package serializer."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tarfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SPEC_VERSION = "0.1.0"
MIN_SPE_VERSION = "0.1.0"

STANDARD_DIRS = [
    "providers",
    "tests",
    "policies",
    "capabilities",
    "provenance",
    "evidence",
    "model-passports",
    "sbom",
    "signatures",
]

CORE_FILES = [
    "manifest.json",
    "intent.json",
    "requirements.json",
    "prompt-ir.json",
    "effect-plan.json",
]


@dataclass
class PackageManifest:
    spec_version: str
    package_id: str
    package_version: str
    protected_intent_digest: str
    provider_targets: list[str]
    content_digests: dict[str, str] = field(default_factory=dict)
    dependencies: dict[str, str] = field(default_factory=dict)
    minimum_spe_version: str = MIN_SPE_VERSION
    license: str = "Apache-2.0"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    signature_metadata: dict[str, Any] | None = None


class PackageVerificationError(Exception):
    """Raised when package manifest digests do not match files."""


def compute_file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class SpePackage:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root)

    @classmethod
    def create_layout(cls, target_dir: Path | str, package_id: str, version: str = "0.1.0") -> SpePackage:
        p = Path(target_dir)
        p.mkdir(parents=True, exist_ok=True)
        for d in STANDARD_DIRS:
            (p / d).mkdir(exist_ok=True)
            (p / d / ".gitkeep").touch()

        # Seed initial files if missing
        for f in ["intent.json", "requirements.json", "prompt-ir.json", "effect-plan.json"]:
            f_path = p / f
            if not f_path.exists():
                f_path.write_text("{}", encoding="utf-8")

        manifest = PackageManifest(
            spec_version=SPEC_VERSION,
            package_id=package_id,
            package_version=version,
            protected_intent_digest=compute_file_hash(p / "intent.json"),
            provider_targets=["openai", "anthropic", "gemini", "local"],
            dependencies={},
            minimum_spe_version=MIN_SPE_VERSION,
        )
        (p / "manifest.json").write_text(json.dumps(asdict(manifest), indent=2), encoding="utf-8")
        return cls(p)

    def manifest(self) -> PackageManifest:
        mf = self.root / "manifest.json"
        if not mf.exists():
            raise FileNotFoundError(f"Missing manifest.json in {self.root}")
        data = json.loads(mf.read_text(encoding="utf-8"))
        return PackageManifest(**data)

    def update_digests(self) -> None:
        mf = self.manifest()
        digests: dict[str, str] = {}
        for item in sorted(self.root.rglob("*")):
            if item.is_file() and item.name != "manifest.json":
                rel = str(item.relative_to(self.root)).replace("\\", "/")
                digests[rel] = compute_file_hash(item)
        mf.content_digests = digests
        if (self.root / "intent.json").exists():
            mf.protected_intent_digest = digests.get("intent.json", "")
        (self.root / "manifest.json").write_text(json.dumps(asdict(mf), indent=2), encoding="utf-8")


def pack_directory(source_dir: Path | str, output_spe_archive: Path | str) -> Path:
    src = Path(source_dir)
    pkg = SpePackage(src)
    pkg.update_digests()
    out = Path(output_spe_archive)
    out.parent.mkdir(parents=True, exist_ok=True)

    with tarfile.open(out, "w:gz", format=tarfile.PAX_FORMAT) as tar:
        for item in sorted(src.rglob("*")):
            rel = item.relative_to(src)
            tar.add(item, arcname=str(rel), recursive=False)
    return out


def unpack_package(archive_path: Path | str, target_dir: Path | str) -> SpePackage:
    arch = Path(archive_path)
    target = Path(target_dir)
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(arch, "r:gz") as tar:
        tar.extractall(target)
    verify_package_integrity(target)
    return SpePackage(target)


def verify_package_integrity(package_dir: Path | str) -> dict[str, Any]:
    pkg = SpePackage(package_dir)
    mf = pkg.manifest()
    results: dict[str, Any] = {
        "package_id": mf.package_id,
        "package_version": mf.package_version,
        "spec_version": mf.spec_version,
        "files_checked": 0,
        "status": "PASS",
        "mismatches": [],
    }
    for rel_path, expected_hash in mf.content_digests.items():
        actual_path = pkg.root / rel_path
        if not actual_path.exists():
            results["mismatches"].append({"file": rel_path, "error": "MISSING"})
            results["status"] = "FAIL"
            continue
        actual_hash = compute_file_hash(actual_path)
        results["files_checked"] += 1
        if actual_hash != expected_hash:
            results["mismatches"].append({
                "file": rel_path,
                "expected": expected_hash,
                "actual": actual_hash,
                "error": "DIGEST_MISMATCH",
            })
            results["status"] = "FAIL"

    if results["status"] != "PASS":
        raise PackageVerificationError(f"Package integrity verification failed: {results['mismatches']}")
    return results


def inspect_package(package_dir: Path | str) -> dict[str, Any]:
    pkg = SpePackage(package_dir)
    mf = pkg.manifest()
    return {
        "manifest": asdict(mf),
        "files_count": len(list(pkg.root.rglob("*"))),
        "has_intent": (pkg.root / "intent.json").exists(),
        "has_requirements": (pkg.root / "requirements.json").exists(),
        "has_prompt_ir": (pkg.root / "prompt-ir.json").exists(),
        "has_effect_plan": (pkg.root / "effect-plan.json").exists(),
    }


def migrate_package(package_dir: Path | str, target_spec_version: str = SPEC_VERSION) -> dict[str, Any]:
    pkg = SpePackage(package_dir)
    mf = pkg.manifest()
    old_version = mf.spec_version
    mf.spec_version = target_spec_version
    for d in STANDARD_DIRS:
        (pkg.root / d).mkdir(exist_ok=True)
    (pkg.root / "manifest.json").write_text(json.dumps(asdict(mf), indent=2), encoding="utf-8")
    pkg.update_digests()
    return {
        "package_id": mf.package_id,
        "old_spec_version": old_version,
        "new_spec_version": target_spec_version,
        "migrated": True,
    }
