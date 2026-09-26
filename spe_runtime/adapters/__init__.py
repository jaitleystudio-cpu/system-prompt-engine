"""Adapters — local-only side-effect fixtures + portable protocol rendering + env caps."""

from spe_runtime.adapters.environment_capabilities import (
    ENVIRONMENT_CAPABILITY_TAGS,
    TAG_BROWSER_COMPUTER_USE,
    TAG_FILE_ACCESS,
    TAG_REPOSITORY_ACCESS,
    UNTRUSTED_SOURCE,
    EnvironmentCapabilityDeclaration,
    EnvironmentToolResult,
    classify_environment_tool_result,
    conditional_capability_prompt_clause,
    environment_capability_laws,
    select_for_environment_need,
)
from spe_runtime.adapters.local_temp_file import LocalTempFileResult, write_local_temp_file
from spe_runtime.adapters.protocol_render import (
    APPROVED_ADAPTER_IDS,
    render_execution_contract,
    render_with_environment_capability_clause,
)

__all__ = [
    "APPROVED_ADAPTER_IDS",
    "ENVIRONMENT_CAPABILITY_TAGS",
    "EnvironmentCapabilityDeclaration",
    "EnvironmentToolResult",
    "LocalTempFileResult",
    "TAG_BROWSER_COMPUTER_USE",
    "TAG_FILE_ACCESS",
    "TAG_REPOSITORY_ACCESS",
    "UNTRUSTED_SOURCE",
    "classify_environment_tool_result",
    "conditional_capability_prompt_clause",
    "environment_capability_laws",
    "render_execution_contract",
    "render_with_environment_capability_clause",
    "select_for_environment_need",
    "write_local_temp_file",
]
