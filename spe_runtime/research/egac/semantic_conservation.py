"""
SPE Ω — Mechanism A: Semantic Conservation System
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
import re
import time
from typing import List, Optional

from spe_runtime.research.egac.types import (
    InformationClass,
    InformationNode,
    SemanticDiff,
    OptimizationCandidate,
    ConservationStatus,
    TechniqueType,
)

class SemanticConservationSystem:
    """
    Mechanism A: Enforces conservation of mandatory semantic, byte-level,
    and security invariants across prompt optimization transformations.
    """

    def __init__(self):
        self._invariant_regex = re.compile(
            r"(?:must|never|do not|cannot|shall not|zero|strictly|prohibited|mandatory|required|forbidden|disallowed|restricted|"
            r"confidential|privacy|authorized|security|invariant|do\s+not\s+transmit|never\s+transmit|no\s+external|"
            r"zero\s+egress|block\s+outgoing|prevent\s+exfiltration|air-gap|"
            r"外部に送信してはならない|送信禁止|必須|厳禁|禁止|不可|機密|不変条件|"
            r"严禁向外部传输|不得|绝不|必须|机密|不变性|"
            r"nunca|no\s+transmitir|estrictamente\s+prohibido|obligatorio|confidencial|cero\s+egreso|"
            r"ne\s+jamais|strictement\s+interdit|interdit|obligatoire|confidentiel|zéro\s+sortie|"
            r"niemals|nie|streng\s+verboten|verboten|vertraulich|kein\s+datenabfluss|"
            r"कभी\s+न\s+भेजें|कभी\s+नहीं|बाहर\s+न\s+भेजें|प्रतिबंधित|अनिवार्य|गोपनीय)",
            re.IGNORECASE,
        )

    def classify_nodes(
        self,
        raw_text: str,
        custom_invariants: Optional[List[str]] = None,
    ) -> List[InformationNode]:
        """
        Decomposes input prompt / context into atomic InformationNodes
        categorized across the 5 canonical information classes.
        """
        nodes: List[InformationNode] = []
        lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

        custom_invs = custom_invariants or []

        for i, line in enumerate(lines):
            node_id = f"node-{i:03d}"
            byte_hash = hashlib.sha256(line.encode("utf-8")).hexdigest()
            lower = line.lower()

            # Rule 1: Protected Requirements
            if (
                any(inv.lower() in lower for inv in custom_invs)
                or self._invariant_regex.search(line)
                or "security" in lower
                or "privacy" in lower
                or "do not transmit" in lower
                or "authorized" in lower
                or "invariant" in lower
            ):
                nodes.append(
                    InformationNode(
                        node_id=node_id,
                        classification=InformationClass.PROTECTED_REQUIREMENTS,
                        content=line,
                        byte_hash=byte_hash,
                        invariants=[line],
                    )
                )

            # Rule 2: Exact-Byte Material (code blocks, hashes, json schemas, regexes)
            elif (
                line.startswith("{")
                or line.startswith("[")
                or "sha256:" in lower
                or "hash:" in lower
                or "def " in line
                or "class " in line
                or "```" in line
                or "regex:" in lower
            ):
                nodes.append(
                    InformationNode(
                        node_id=node_id,
                        classification=InformationClass.EXACT_BYTE_MATERIAL,
                        content=line,
                        byte_hash=byte_hash,
                        invariants=[f"exact_byte:{byte_hash}"],
                    )
                )

            # Rule 3: Evidence-Bearing Material (citations, experimental observations, numbers, claims)
            elif (
                "doi:" in lower
                or "arxiv:" in lower
                or "table " in lower
                or "measured" in lower
                or "experiment" in lower
                or "vsod" in lower
                or "reported" in lower
                or re.search(r"\b\d+(\.\d+)?%\b", line)
            ):
                nodes.append(
                    InformationNode(
                        node_id=node_id,
                        classification=InformationClass.EVIDENCE_BEARING_MATERIAL,
                        content=line,
                        byte_hash=byte_hash,
                        invariants=[f"evidence:{line[:40]}"],
                    )
                )

            # Rule 4: Volatile Information (timestamps, session tokens, ephemeral states)
            elif (
                "session" in lower
                or "timestamp" in lower
                or "expires" in lower
                or "current time" in lower
                or "freshness" in lower
                or "token:" in lower
            ):
                nodes.append(
                    InformationNode(
                        node_id=node_id,
                        classification=InformationClass.VOLATILE_INFORMATION,
                        content=line,
                        byte_hash=byte_hash,
                        invariants=[f"volatile:{node_id}"],
                        freshness_timestamp=time.time(),
                        invalidation_conditions=["ttl_exceeded", "scope_changed"],
                    )
                )

            # Rule 5: Replaceable Context (default narrative prose, greetings, explanations)
            else:
                nodes.append(
                    InformationNode(
                        node_id=node_id,
                        classification=InformationClass.REPLACEABLE_CONTEXT,
                        content=line,
                        byte_hash=byte_hash,
                        invariants=[],
                    )
                )

        return nodes

    def evaluate_transformation(
        self,
        source_nodes: List[InformationNode],
        transformed_text: str,
        technique: TechniqueType,
    ) -> SemanticDiff:
        """
        Validates whether transformed text rigorously conserves all
        required semantic, byte, and evidence invariants.
        """
        trans_lower = transformed_text.lower()
        preserved: List[str] = []
        violated: List[str] = []
        loss_score: float = 0.0

        src_token_count = sum(len(n.content.split()) for n in source_nodes)
        trans_token_count = len(transformed_text.split())
        removed_tokens = max(0, src_token_count - trans_token_count)
        added_tokens = max(0, trans_token_count - src_token_count)

        for node in source_nodes:
            if node.classification == InformationClass.PROTECTED_REQUIREMENTS:
                # Every invariant must survive intact
                node_lower = node.content.lower().strip()
                if node_lower in trans_lower or node.content in transformed_text:
                    preserved.append(f"PROTECTED: {node.content[:50]}")
                else:
                    # Check semantic survival (key constraint tokens preserved)
                    key_words = [w for w in re.findall(r"\b\w{2,}\b", node_lower) if w not in {"the", "and", "for", "with"}]
                    matched_words = [w for w in key_words if w in trans_lower]
                    survival_ratio = len(matched_words) / max(1, len(key_words)) if key_words else 0.0

                    if survival_ratio >= 0.75:
                        preserved.append(f"PROTECTED: {node.content[:50]}")
                    else:
                        violated.append(f"CRITICAL LOSS: Protected requirement '{node.content}' was weakened or dropped.")
                        loss_score += 1.0

            elif node.classification == InformationClass.EXACT_BYTE_MATERIAL:
                # Must retain byte representation or valid structured equivalent
                # If it's JSON minification, parsed structure must match, else bytes
                if technique == TechniqueType.JSON_MINIFICATION:
                    # Normalized match check
                    norm_src = re.sub(r"\s+", "", node.content)
                    norm_trans = re.sub(r"\s+", "", transformed_text)
                    if norm_src in norm_trans or norm_trans in norm_src:
                        preserved.append(f"EXACT_BYTE (minified): {node.node_id}")
                    else:
                        violated.append(f"EXACT_BYTE CORRUPTION: {node.content[:40]}")
                        loss_score += 0.8
                else:
                    if node.content in transformed_text:
                        preserved.append(f"EXACT_BYTE: {node.node_id}")
                    else:
                        violated.append(f"EXACT_BYTE MISMATCH: {node.content[:40]}")
                        loss_score += 0.8

            elif node.classification == InformationClass.EVIDENCE_BEARING_MATERIAL:
                # Must preserve traceable factual claims or numerical values
                nums = re.findall(r"\b\d+(?:\.\d+)?\b", node.content)
                survived_nums = [n for n in nums if n in transformed_text]
                if len(nums) == 0 or len(survived_nums) == len(nums):
                    preserved.append(f"EVIDENCE: {node.node_id}")
                else:
                    violated.append(f"EVIDENCE LOSS: Data points {set(nums) - set(survived_nums)} dropped.")
                    loss_score += 0.5

            elif node.classification == InformationClass.VOLATILE_INFORMATION:
                # Must not be expired or stale
                if node.freshness_timestamp and (time.time() - node.freshness_timestamp) > 3600:
                    violated.append(f"STALE VOLATILE DATA: {node.node_id} expired.")
                    loss_score += 0.3
                else:
                    preserved.append(f"VOLATILE (fresh): {node.node_id}")

            elif node.classification == InformationClass.REPLACEABLE_CONTEXT:
                # Replaceable context can be summarized or removed
                preserved.append(f"REPLACEABLE: {node.node_id}")

        is_conservative = len(violated) == 0 and loss_score == 0.0
        explanation = (
            f"Conserved {len(preserved)} invariants. {len(violated)} violations."
            if not is_conservative
            else f"Full semantic conservation satisfied across {len(preserved)} nodes."
        )

        return SemanticDiff(
            added_tokens=added_tokens,
            removed_tokens=removed_tokens,
            preserved_invariants=preserved,
            violated_invariants=violated,
            information_loss_score=loss_score,
            is_conservative=is_conservative,
            explanation=explanation,
        )

    def validate_candidate(
        self,
        candidate: OptimizationCandidate,
        source_nodes: List[InformationNode],
    ) -> OptimizationCandidate:
        """
        Validates an optimization candidate and sets its status.
        """
        diff = self.evaluate_transformation(
            source_nodes,
            candidate.transformed_content,
            candidate.technique,
        )
        candidate.diff = diff

        if candidate.status == ConservationStatus.VIOLATED:
            if not diff.is_conservative:
                candidate.rejection_reason = (
                    (candidate.rejection_reason or "") + "; " + "; ".join(diff.violated_invariants)
                ).strip("; ")
            return candidate

        if diff.is_conservative:
            candidate.status = ConservationStatus.CONSERVED
            candidate.rejection_reason = None
        else:
            candidate.status = ConservationStatus.VIOLATED
            candidate.rejection_reason = "; ".join(diff.violated_invariants)

        return candidate
