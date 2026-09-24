"""Adapters — local-only side-effect fixtures + portable protocol rendering."""

from spe_runtime.adapters.local_temp_file import LocalTempFileResult, write_local_temp_file
from spe_runtime.adapters.protocol_render import (
    APPROVED_ADAPTER_IDS,
    render_execution_contract,
)

__all__ = [
    "APPROVED_ADAPTER_IDS",
    "LocalTempFileResult",
    "render_execution_contract",
    "write_local_temp_file",
]
