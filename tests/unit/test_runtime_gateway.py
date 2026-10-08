"""Tests for SPE Runtime Gateway, Capability Firewall, MCP, and A2A Delegation (M11 & M12)."""

from spe_runtime.runtime_gateway.a2a_delegation import A2APolicyEngine
from spe_runtime.runtime_gateway.firewall import CapabilityFirewall
from spe_runtime.runtime_gateway.mcp_adapter import McpCapabilityAdapter
from spe_runtime.runtime_gateway.models import (
    A2ADelegationContract,
    CapabilityGrant,
    CapabilityRequest,
    CapabilityType,
    Decision,
)


def test_capability_firewall_enforcement():
    fw = CapabilityFirewall()

    # Install read grant for /var/log/*
    grant = CapabilityGrant(
        grant_id="grant-read-logs",
        capability=CapabilityType.READ_FILE,
        resource_scope="/var/log/*",
        action_scope="read",
        issuer="sec-ops",
        approval_identity="appr-01",
        expiration_iso="2030-01-01T00:00:00Z",
        nonce="n-123",
        signature="sig-abc",
    )
    fw.install_grant(grant)

    # Allowed request
    req1 = CapabilityRequest(
        capability=CapabilityType.READ_FILE,
        target_resource="/var/log/app.log",
        action="read",
        agent_id="agent-audit",
    )
    res1 = fw.evaluate_request(req1)
    assert res1.decision == Decision.ALLOW

    # Denied request (path outside scope)
    req2 = CapabilityRequest(
        capability=CapabilityType.READ_FILE,
        target_resource="/etc/shadow",
        action="read",
        agent_id="agent-audit",
    )
    res2 = fw.evaluate_request(req2)
    assert res2.decision == Decision.DENY

    # Denied request (capability not granted: delete)
    req3 = CapabilityRequest(
        capability=CapabilityType.DELETE_FILE,
        target_resource="/var/log/app.log",
        action="delete",
        agent_id="agent-audit",
    )
    res3 = fw.evaluate_request(req3)
    assert res3.decision == Decision.DENY


def test_mcp_adapter_gate():
    fw = CapabilityFirewall()
    fw.install_grant(
        CapabilityGrant(
            grant_id="g-mcp-web",
            capability=CapabilityType.NETWORK,
            resource_scope="https://api.github.com/*",
            action_scope="read",
            issuer="admin",
            approval_identity="appr-mcp",
            expiration_iso="2030-01-01T00:00:00Z",
            nonce="n-456",
            signature="sig-xyz",
        )
    )
    adapter = McpCapabilityAdapter(fw)

    # Allowed tool call
    res_allow = adapter.validate_tool_call(
        tool_name="fetch_url",
        tool_arguments={"url": "https://api.github.com/repos"},
        agent_id="agent-1",
    )
    assert res_allow.decision == Decision.ALLOW

    # Denied tool call (blocked external url)
    res_deny = adapter.validate_tool_call(
        tool_name="fetch_url",
        tool_arguments={"url": "https://malicious.site/data"},
        agent_id="agent-1",
    )
    assert res_deny.decision == Decision.DENY


def test_a2a_delegation_contracts():
    engine = A2APolicyEngine()
    contract = A2ADelegationContract(
        contract_id="contract-research-01",
        delegator_agent_id="Agent-Manager",
        delegatee_agent_id="Agent-Worker",
        allowed_capabilities=[CapabilityType.NETWORK, CapabilityType.READ_FILE],
        forbidden_capabilities=[CapabilityType.PAYMENT, CapabilityType.PRODUCTION_CHANGE],
        expiration_iso="2030-01-01T00:00:00Z",
    )
    engine.register_contract(contract)

    # Allowed delegation: Worker can read file
    res1 = engine.evaluate_delegation("Agent-Manager", "Agent-Worker", CapabilityType.READ_FILE)
    assert res1.decision == Decision.ALLOW

    # Forbidden delegation: Worker cannot make payments
    res2 = engine.evaluate_delegation("Agent-Manager", "Agent-Worker", CapabilityType.PAYMENT)
    assert res2.decision == Decision.DENY

    # Unspecified delegation: Database write
    res3 = engine.evaluate_delegation("Agent-Manager", "Agent-Worker", CapabilityType.DATABASE_WRITE)
    assert res3.decision == Decision.DENY
