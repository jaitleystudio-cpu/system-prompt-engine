"""Tests for Signed Package Registry and Packs (M16 & M17)."""

from pathlib import Path
import pytest

from spe_runtime.ci_gate.receipt import ed25519_sign, generate_keypair
from spe_runtime.registry.models import PackageType, QuarantineStatus, RegistryPackage
from spe_runtime.registry.registry import (
    PackageQuarantineError,
    PackageSignatureError,
    SignedPackageRegistry,
)
from spe_runtime.spe_package.spec import pack_directory, SpePackage


def test_signed_package_registry_publish_and_quarantine(tmp_path: Path):
    reg = SignedPackageRegistry(tmp_path / "registry")

    # Create dummy package directory & archive
    pkg_dir = tmp_path / "pkg_src"
    SpePackage.create_layout(pkg_dir, "sql-safe-agent")
    archive = tmp_path / "pkg.tar.gz"
    pack_directory(pkg_dir, archive)

    # Keypair
    sk, pk = generate_keypair()
    digest = "sha256-dummy-1234567890abcdef1234567890abcdef"
    sig = ed25519_sign(sk, pk, digest.encode("utf-8")).hex()

    pkg = RegistryPackage(
        namespace="@spe",
        name="sql-safe-agent",
        version="1.0.0",
        package_type=PackageType.ASSURANCE_PACK,
        digest_sha256=digest,
        signature_ed25519=sig,
        publisher_public_key=pk.hex(),
        license="Apache-2.0",
        supported_models=["gpt-4o", "claude-3-5-sonnet"],
        test_coverage_pct=95.0,
        known_limitations=[],
        published_at="2026-10-08T00:00:00Z",
    )

    # 1. Publish
    id_published = reg.publish_package(pkg, archive)
    assert id_published == "@spe/sql-safe-agent@1.0.0"

    # 2. Install
    install_target = tmp_path / "installed_pkg"
    installed = reg.install_package(id_published, install_target)
    assert installed.download_count == 1
    assert (install_target / "manifest.json").exists()

    # 3. Quarantine & Verify Installation Block
    reg.quarantine_package(id_published, reason="Reported false positive in injection rule")
    target_2 = tmp_path / "blocked_install"
    with pytest.raises(PackageQuarantineError):
        reg.install_package(id_published, target_2)


def test_registry_rejects_invalid_signature(tmp_path: Path):
    reg = SignedPackageRegistry(tmp_path / "registry")
    pkg_dir = tmp_path / "pkg_src2"
    SpePackage.create_layout(pkg_dir, "bad-agent")
    archive = tmp_path / "bad.tar.gz"
    pack_directory(pkg_dir, archive)

    _, pk = generate_keypair()
    bad_sig = "0" * 128

    bad_pkg = RegistryPackage(
        namespace="@evil",
        name="bad-agent",
        version="0.1.0",
        package_type=PackageType.INSTRUCTION_PACK,
        digest_sha256="abc",
        signature_ed25519=bad_sig,
        publisher_public_key=pk.hex(),
        license="MIT",
        supported_models=[],
        test_coverage_pct=0.0,
        known_limitations=[],
        published_at="2026-10-08T00:00:00Z",
    )

    with pytest.raises(PackageSignatureError):
        reg.publish_package(bad_pkg, archive)
