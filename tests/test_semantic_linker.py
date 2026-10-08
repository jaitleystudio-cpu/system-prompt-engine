"""Tests for Behavioral ABI, Semantic Linker, and SLTO."""

import pytest
from spe_runtime.semantic_linker import (
    BehavioralSignature,
    DeoptGuard,
    LinkedAssembly,
    LinkError,
    SemanticLinker,
    SemanticLinkTimeOptimizer,
)


def test_semantic_linker_catches_freshness_mismatch():
    linker = SemanticLinker()

    retriever = BehavioralSignature(
        module_name="WebPricingRetriever",
        guarantees={"price_freshness_seconds": 3600, "verified_source": True},
    )

    # Planner requires fresh data within 15 minutes (900 seconds)
    planner = BehavioralSignature(
        module_name="HighFrequencyPurchasePlanner",
        requires={"price_freshness_seconds": 900, "verified_source": True},
    )

    assembly: LinkedAssembly = linker.link([retriever, planner])
    assert assembly.is_link_clean is False
    assert len(assembly.link_errors) == 1

    err = assembly.link_errors[0]
    assert err.error_code == "SPE-LNK-041"
    assert err.consumer_module == "HighFrequencyPurchasePlanner"
    assert "freshness <= 900s" in err.required_value


def test_semantic_linker_clean_composition():
    linker = SemanticLinker()

    retriever = BehavioralSignature(
        module_name="RealtimeCacheRetriever",
        guarantees={"price_freshness_seconds": 60, "verified_source": True},
    )

    planner = BehavioralSignature(
        module_name="PurchasePlanner",
        requires={"price_freshness_seconds": 900, "verified_source": True},
    )

    assembly = linker.link([retriever, planner])
    assert assembly.is_link_clean is True
    assert len(assembly.link_errors) == 0


def test_slto_eliminates_redundant_instructions():
    optimizer = SemanticLinkTimeOptimizer()
    linker = SemanticLinker()

    mod1 = BehavioralSignature(module_name="AgentA", guarantees={"data_cleaned": True})
    assembly = linker.link([mod1])

    prompts = {
        "AgentA": [
            "Perform customer summary.",
            "NEVER reveal private data or sensitive PII to the user.",
            "Format summary as markdown list.",
        ]
    }

    # If RUNTIME_PII_GUARD is active in Capability Firewall, SLTO removes the redundant prompt clause
    runtime_guards = {"RUNTIME_PII_GUARD"}
    optimized_prompts, opt_assembly = optimizer.optimize(assembly, runtime_guards, prompts)

    clauses_after = optimized_prompts["AgentA"]
    assert len(clauses_after) == 2
    assert "Format summary as markdown list." in clauses_after
    assert not any("PII" in c for c in clauses_after)

    # Deopt guard created to restore clause if runtime guard is disabled
    assert len(opt_assembly.deopt_guards) == 1
    assert opt_assembly.deopt_guards[0].guard_id == "deopt_AgentA_runtime_pii_guard"
    assert opt_assembly.token_savings > 0
