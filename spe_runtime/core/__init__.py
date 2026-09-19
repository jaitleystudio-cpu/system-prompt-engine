"""G4-ZC zero-cost SPE core — offline portable prompt compilation.

No network. No provider credentials. No paid model APIs.
Provider adapters remain optional interoperability (G4X), not a core dependency.
"""

from spe_runtime.core.compile import (
    CompileResult,
    compile_and_persist_spe,
    compile_portable_request,
)

__all__ = [
    "CompileResult",
    "compile_portable_request",
    "compile_and_persist_spe",
]
