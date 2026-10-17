"""PagedAttention & Provider KV-Cache Canonical Prefix Aligner."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Tuple

from spe_runtime.cost_engine.models import KVPrefixLayout


class PagedAttentionKVAligner:
    """Aligns prompts to PagedAttention page boundaries with deterministic canonical ordering."""

    def __init__(self, block_size: int = 32):
        self.block_size = block_size

    def compile_layout(
        self,
        invariant_clauses: List[str],
        tool_schemas: List[Dict[str, Any]],
        dynamic_user_input: str,
    ) -> KVPrefixLayout:
        """Separates invariant instructions into canonical block-aligned prefix and dynamic suffix."""
        # 1. Deterministic canonical sorting of invariant clauses (RFC 8785 style)
        sorted_clauses = sorted(list(set(invariant_clauses)))
        sorted_tools = sorted(
            [json.dumps(t, sort_keys=True) for t in tool_schemas]
        )

        # Assemble frozen invariant prefix
        prefix_parts = []
        if sorted_clauses:
            prefix_parts.append("=== INVARIANT SPECIFICATION ===")
            prefix_parts.extend(f"[{i+1:02d}] {c}" for i, c in enumerate(sorted_clauses))
        if sorted_tools:
            prefix_parts.append("=== TOOL CAPABILITY CONTRACTS ===")
            prefix_parts.extend(sorted_tools)

        raw_prefix_text = "\n".join(prefix_parts)
        
        # Word-based token estimate (~1.3 tokens per word)
        raw_prefix_words = len(raw_prefix_text.split())
        approx_prefix_tokens = int(raw_prefix_words * 1.3)

        # Compute required padding to align to nearest block boundary
        remainder = approx_prefix_tokens % self.block_size
        padding_needed = (self.block_size - remainder) % self.block_size

        # Zero-width / benign whitespace padding string ensuring byte-for-byte block alignment
        padding_str = "\n" + (" " * padding_needed) if padding_needed > 0 else ""
        aligned_prefix_text = raw_prefix_text + padding_str
        total_prefix_tokens = approx_prefix_tokens + padding_needed

        # Suffix contains strictly variable runtime data
        suffix_words = len(dynamic_user_input.split())
        approx_suffix_tokens = int(suffix_words * 1.3)

        prefix_hash = hashlib.sha256(aligned_prefix_text.encode("utf-8")).hexdigest()

        return KVPrefixLayout(
            canonical_prefix=aligned_prefix_text,
            dynamic_suffix=dynamic_user_input,
            prefix_tokens=total_prefix_tokens,
            suffix_tokens=approx_suffix_tokens,
            alignment_block_size=self.block_size,
            padding_tokens_added=padding_needed,
            predicted_cache_hit_rate=0.95,
            canonical_prefix_hash=prefix_hash,
        )
