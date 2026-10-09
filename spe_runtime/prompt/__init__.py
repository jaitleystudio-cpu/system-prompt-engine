"""
SPE Ω — Autonomous Meta-Prompt Compiler & Zero-Drift Execution Subsystem.
Transforms raw informal user prompts into domain-specialized Master Execution Plans,
enforces zero semantic drift via ZeroDriftSentry, and verifies 100% completion
against Kleene 3-valued verification obligations before issuing cryptographic receipts.
"""

from spe_runtime.prompt.meta_compiler import (
    AdmissibleTools,
    CompletionCertificate,
    CompletionRejectedError,
    DriftType,
    DriftVerdict,
    ExecutionPlacementCertificate,
    GeneratedMasterSystemPrompt,
    MasterExecutionPlan,
    MetaPromptCompiler,
    Obligation,
    ObligationSet,
    ProtectedIntent,
    SemanticDriftViolationError,
    SelfVerifyingCompletionHarness,
    ZeroDriftSentry,
)

__all__ = [
    "AdmissibleTools",
    "CompletionCertificate",
    "CompletionRejectedError",
    "DriftType",
    "DriftVerdict",
    "ExecutionPlacementCertificate",
    "GeneratedMasterSystemPrompt",
    "MasterExecutionPlan",
    "MetaPromptCompiler",
    "Obligation",
    "ObligationSet",
    "ProtectedIntent",
    "SemanticDriftViolationError",
    "SelfVerifyingCompletionHarness",
    "ZeroDriftSentry",
]
