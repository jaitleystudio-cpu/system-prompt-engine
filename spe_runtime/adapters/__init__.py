"""Adapters — local-only side-effect fixtures (Sprint 3). No paid APIs."""

from spe_runtime.adapters.local_temp_file import LocalTempFileResult, write_local_temp_file

__all__ = ["LocalTempFileResult", "write_local_temp_file"]
