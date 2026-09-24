"""Render ExecutionContract into portable, auditable adapter text.

Adapters may change syntax/order but must not drop mandatory protocol nodes
or emit hidden chain-of-thought requests. Vendor-specific IDs are only
accepted when already present in the repository (currently: ANY_AI only).
"""

from __future__ import annotations

import re

from spe_runtime.protocols.compiler import ExecutionContract
from spe_runtime.protocols.models import ProtocolNode

# Discoverable approved adapter IDs — do not invent vendor lock-in here.
APPROVED_ADAPTER_IDS = frozenset({"ANY_AI"})

_WS_RE = re.compile(r"[ \t]+")
_BLANK_RE = re.compile(r"\n{3,}")


def _compact(text: str) -> str:
    """Collapse redundant whitespace while preserving line structure."""
    lines = [_WS_RE.sub(" ", line).rstrip() for line in text.splitlines()]
    return _BLANK_RE.sub("\n\n", "\n".join(lines)).strip() + "\n"


def _render_node(node: ProtocolNode, index: int) -> str:
    """Emit one auditable stage block (title + instruction + exit)."""
    parts = [
        f"### {index}. [{node.stage}] {node.title}",
        f"Instruction: {node.instruction.strip()}",
    ]
    if node.exit_condition:
        parts.append(f"Exit: {node.exit_condition.strip()}")
    if node.evidence_required:
        parts.append("Evidence: required")
    if node.failure_behavior:
        parts.append(f"On failure: {node.failure_behavior}")
    return "\n".join(parts)


def render_execution_contract(contract: ExecutionContract, adapter_id: str) -> str:
    """Render a compiled contract for the named adapter.

    ``ANY_AI`` stays portable: no vendor product names; conditional auto-routing
    text is preserved from the capability node instruction when present.
    Renderer emits auditable stage titles/instructions only — never hidden
    chain-of-thought requests. Required nodes are preserved in graph order.
    """
    if not isinstance(contract, ExecutionContract):
        raise TypeError("contract must be an ExecutionContract")
    adapter = str(adapter_id).strip()
    if adapter not in APPROVED_ADAPTER_IDS:
        raise ValueError(
            f"unknown adapter_id={adapter!r}; approved: {sorted(APPROVED_ADAPTER_IDS)}"
        )

    nodes = contract.graph.nodes
    header_lines = [
        f"# Execution Contract ({adapter})",
        f"Domains: {', '.join(contract.domain_ids)}",
        f"Depth: {contract.depth.value}",
        f"Protocol: {contract.protocol_id}",
        "",
        "## Stages (auditable titles and instructions only)",
        "",
    ]
    body = [_render_node(node, i) for i, node in enumerate(nodes, start=1)]
    return _compact("\n".join(header_lines) + "\n\n".join(body))
