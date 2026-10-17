"""Signed SPE Package Registry implementation."""

from __future__ import annotations

import json
import shutil
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from spe_runtime.ci_gate.receipt import ed25519_verify
from spe_runtime.spe_package.spec import unpack_package

from .models import PackageType, QuarantineStatus, RegistryPackage


class PackageQuarantineError(Exception):
    """Raised when attempting to install a quarantined or revoked package."""


class PackageSignatureError(Exception):
    """Raised when package signature verification fails."""


class SignedPackageRegistry:
    def __init__(self, root_dir: Path | str) -> None:
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.meta_dir = self.root_dir / "metadata"
        self.artifacts_dir = self.root_dir / "artifacts"
        self.meta_dir.mkdir(exist_ok=True)
        self.artifacts_dir.mkdir(exist_ok=True)
        self._index: dict[str, RegistryPackage] = {}
        self._load()

    def publish_package(self, pkg: RegistryPackage, archive_file: Path | str) -> str:
        # Verify Ed25519 signature before publishing
        if not self.verify_package_signature(pkg):
            raise PackageSignatureError(f"Signature verification failed for package {pkg.identifier}")

        dest_archive = self.artifacts_dir / f"{pkg.namespace.replace('@', '')}__{pkg.name}__{pkg.version}.spe.tar.gz"
        shutil.copyfile(archive_file, dest_archive)

        self._index[pkg.identifier] = pkg
        self._save_pkg(pkg)
        return pkg.identifier

    def install_package(self, identifier: str, destination_dir: Path | str) -> RegistryPackage:
        pkg = self._index.get(identifier)
        if not pkg:
            raise KeyError(f"Package {identifier} not found in registry.")

        if pkg.quarantine_status != QuarantineStatus.CLEAN:
            raise PackageQuarantineError(f"Package {identifier} is {pkg.quarantine_status.value} and cannot be installed.")

        # Locate archive
        archive_name = f"{pkg.namespace.replace('@', '')}__{pkg.name}__{pkg.version}.spe.tar.gz"
        archive_path = self.artifacts_dir / archive_name
        if not archive_path.exists():
            raise FileNotFoundError(f"Archive missing for {identifier}")

        unpack_package(archive_path, destination_dir)
        pkg.download_count += 1
        self._save_pkg(pkg)
        return pkg

    def offline_install(self, local_archive: Path | str, destination_dir: Path | str) -> None:
        """Installs package locally without querying remote registry."""
        unpack_package(local_archive, destination_dir)

    def verify_package_signature(self, pkg: RegistryPackage) -> bool:
        try:
            pk = bytes.fromhex(pkg.publisher_public_key)
            sig = bytes.fromhex(pkg.signature_ed25519)
            msg = pkg.digest_sha256.encode("utf-8")
            return ed25519_verify(pk, msg, sig)
        except Exception:
            return False

    def quarantine_package(self, identifier: str, reason: str) -> None:
        pkg = self._index.get(identifier)
        if not pkg:
            raise KeyError(f"Package {identifier} not found.")
        pkg.quarantine_status = QuarantineStatus.QUARANTINED
        pkg.metadata["quarantine_reason"] = reason
        self._save_pkg(pkg)

    def revoke_package(self, identifier: str, reason: str) -> None:
        pkg = self._index.get(identifier)
        if not pkg:
            raise KeyError(f"Package {identifier} not found.")
        pkg.quarantine_status = QuarantineStatus.REVOKED
        pkg.metadata["revocation_reason"] = reason
        self._save_pkg(pkg)

    def _save_pkg(self, pkg: RegistryPackage) -> None:
        fname = f"{pkg.namespace.replace('@', '')}__{pkg.name}__{pkg.version}.json"
        p_path = self.meta_dir / fname
        data = asdict(pkg)
        data["package_type"] = pkg.package_type.value
        data["quarantine_status"] = pkg.quarantine_status.value
        p_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _load(self) -> None:
        for f in self.meta_dir.glob("*.json"):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                d["package_type"] = PackageType(d["package_type"])
                d["quarantine_status"] = QuarantineStatus(d["quarantine_status"])
                pkg = RegistryPackage(**d)
                self._index[pkg.identifier] = pkg
            except Exception:
                pass
