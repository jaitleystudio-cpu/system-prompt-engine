"""SPE Ω — Open .spe Package Specification v0.1 & Prompt ABI (M2)."""

from .abi import (
    PromptABI,
    PromptDialectAdapter,
    lower_abi_to_provider,
)
from .spec import (
    PackageManifest,
    SpePackage,
    inspect_package,
    migrate_package,
    pack_directory,
    unpack_package,
    verify_package_integrity,
)

__all__ = [
    "PackageManifest",
    "SpePackage",
    "pack_directory",
    "unpack_package",
    "inspect_package",
    "verify_package_integrity",
    "migrate_package",
    "PromptABI",
    "PromptDialectAdapter",
    "lower_abi_to_provider",
]
