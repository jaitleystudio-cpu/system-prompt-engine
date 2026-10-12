"""EGAC-1 (Evidence-Gated Adaptive Compute) — R0 slice. Research proposal; no novelty claims.

Mechanism A: semantic conservation. Text is classified into five information classes and every local
optimisation technique is run through a gate that refuses changes to protected / exact-byte spans.
Reuses `spe_runtime.prompt.meta_compiler.ProtectedIntent` as the source of protected requirements.
"""
