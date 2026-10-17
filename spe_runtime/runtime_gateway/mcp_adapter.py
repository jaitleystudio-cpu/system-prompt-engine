"""MCP Capability Adapter and Tool Policy Gateway."""

from __future__ import annotations

from typing import Any

from .firewall import CapabilityFirewall
from .models import CapabilityRequest, CapabilityType, Decision, PolicyEvaluationResult

MCP_TOOL_CAPABILITY_MAP: dict[str, tuple[CapabilityType, str]] = {
    "read_file": (CapabilityType.READ_FILE, "read"),
    "write_file": (CapabilityType.WRITE_FILE, "write"),
    "delete_file": (CapabilityType.DELETE_FILE, "delete"),
    "execute_command": (CapabilityType.TOOL_EXECUTE, "execute"),
    "fetch_url": (CapabilityType.NETWORK, "read"),
    "send_email": (CapabilityType.SEND_EMAIL, "send"),
    "query_db": (CapabilityType.DATABASE_READ, "read"),
    "mutate_db": (CapabilityType.DATABASE_WRITE, "write"),
    "git_commit": (CapabilityType.GIT_COMMIT, "commit"),
    "git_push": (CapabilityType.GIT_PUSH, "push"),
}


class McpCapabilityAdapter:
    def __init__(self, firewall: CapabilityFirewall) -> None:
        self.firewall = firewall

    def validate_tool_call(
        self,
        tool_name: str,
        tool_arguments: dict[str, Any],
        agent_id: str,
    ) -> PolicyEvaluationResult:
        mapping = MCP_TOOL_CAPABILITY_MAP.get(tool_name)
        if not mapping:
            # Fallback to generic tool execution
            cap = CapabilityType.TOOL_EXECUTE
            action = "execute"
            resource = tool_name
        else:
            cap, action = mapping
            # Extract target resource
            resource = (
                tool_arguments.get("path")
                or tool_arguments.get("url")
                or tool_arguments.get("target")
                or tool_name
            )

        req = CapabilityRequest(
            capability=cap,
            target_resource=str(resource),
            action=action,
            agent_id=agent_id,
            context={"tool_name": tool_name, "args": tool_arguments},
        )
        return self.firewall.evaluate_request(req)
