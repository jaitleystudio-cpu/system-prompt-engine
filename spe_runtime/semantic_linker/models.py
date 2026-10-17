"""Data models for Behavioral ABI, AI Linker, and Semantic Link-Time Optimizer (SLTO)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class BehavioralSignature:
    """Exported behavioral contract of an agent, prompt, tool, or RAG retriever."""
    module_name: str
    requires: Dict[str, Any] = field(default_factory=dict)
    guarantees: Dict[str, Any] = field(default_factory=dict)
    may_effect: List[str] = field(default_factory=list)
    authority_needed: List[str] = field(default_factory=list)
    evidence_needed: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class LinkError:
    """Contract incompatibility between linked AI modules."""
    error_code: str
    consumer_module: str
    producer_module: str
    failing_requirement: str
    required_value: Any
    guaranteed_value: Any
    counterexample_scenario: str


@dataclass(frozen=True)
class DeoptGuard:
    """Runtime predicate guarding a fast-path optimized execution."""
    guard_id: str
    predicate: str
    fallback_target: str


@dataclass
class LinkedAssembly:
    """Result of semantic linking and link-time optimization."""
    modules: List[BehavioralSignature]
    link_errors: List[LinkError] = field(default_factory=list)
    is_link_clean: bool = True
    eliminated_redundancies: List[str] = field(default_factory=list)
    deopt_guards: List[DeoptGuard] = field(default_factory=list)
    token_savings: int = 0
