"""Evidence-Preserving Compression candidate evaluation and qualification."""

from __future__ import annotations

import re
from typing import Any, Callable

from .models import CompressionCandidate, CompressionStatus


class EvidencePreservingCompressionEngine:
    def __init__(self) -> None:
        pass

    def prune_candidate(self, prompt: str) -> str:
        """Heuristic candidate pruning: removes filler markdown, verbose politeness, and duplicate whitespace."""
        lines = prompt.splitlines()
        pruned_lines = []
        for line in lines:
            s = line.strip()
            pattern = re.compile(r"^(please note that|as an ai language model|kindly ensure that)[,\s]*", re.IGNORECASE)
            while True:
                new_s = pattern.sub("", s).strip()
                if new_s == s:
                    break
                s = new_s
            # Retain non-empty lines
            if s:
                pruned_lines.append(s)
        return "\n".join(pruned_lines)


def evaluate_compression_candidate(
    original_prompt: str,
    pruned_prompt: str,
    protected_intent_check_fn: Callable[[str, str], bool],
    constraint_suite_check_fn: Callable[[str], bool],
    held_out_eval_fn: Callable[[str], bool],
    adversarial_suite_fn: Callable[[str], bool],
) -> CompressionCandidate:
    orig_tokens = int(len(original_prompt.split()) * 1.3)
    pruned_tokens = int(len(pruned_prompt.split()) * 1.3)
    saved_pct = round(((orig_tokens - pruned_tokens) / max(orig_tokens, 1)) * 100.0, 1)

    trail: list[str] = [f"Tokens reduced from {orig_tokens} to {pruned_tokens} ({saved_pct}% saved)"]

    # 1. ProtectedIntent check
    intent_ok = protected_intent_check_fn(original_prompt, pruned_prompt)
    if not intent_ok:
        trail.append("ProtectedIntent mutated: REJECTED")
        return CompressionCandidate(
            original_prompt=original_prompt,
            pruned_prompt=pruned_prompt,
            original_tokens=orig_tokens,
            pruned_tokens=pruned_tokens,
            tokens_saved_pct=saved_pct,
            intent_preserved=False,
            constraints_pass=False,
            held_out_noninferior=False,
            adversarial_pass=False,
            status=CompressionStatus.REJECTED_INTENT_MUTATED,
            evidence_trail=trail,
        )
    trail.append("ProtectedIntent equality: PASS")

    # 2. Constraint suite check
    cons_ok = constraint_suite_check_fn(pruned_prompt)
    if not cons_ok:
        trail.append("Constraint suite regression: REJECTED")
        return CompressionCandidate(
            original_prompt=original_prompt,
            pruned_prompt=pruned_prompt,
            original_tokens=orig_tokens,
            pruned_tokens=pruned_tokens,
            tokens_saved_pct=saved_pct,
            intent_preserved=True,
            constraints_pass=False,
            held_out_noninferior=False,
            adversarial_pass=False,
            status=CompressionStatus.REJECTED_CONSTRAINT_FAILED,
            evidence_trail=trail,
        )
    trail.append("Constraint suite: PASS")

    # 3. Held-out tasks noninferior
    held_ok = held_out_eval_fn(pruned_prompt)
    if not held_ok:
        trail.append("Held-out tasks inferior: REJECTED")
        return CompressionCandidate(
            original_prompt=original_prompt,
            pruned_prompt=pruned_prompt,
            original_tokens=orig_tokens,
            pruned_tokens=pruned_tokens,
            tokens_saved_pct=saved_pct,
            intent_preserved=True,
            constraints_pass=True,
            held_out_noninferior=False,
            adversarial_pass=False,
            status=CompressionStatus.REJECTED_TASK_INFERIOR,
            evidence_trail=trail,
        )
    trail.append("Held-out tasks noninferior: PASS")

    # 4. Adversarial regression PASS
    adv_ok = adversarial_suite_fn(pruned_prompt)
    if not adv_ok:
        trail.append("Adversarial regressions detected: REJECTED")
        return CompressionCandidate(
            original_prompt=original_prompt,
            pruned_prompt=pruned_prompt,
            original_tokens=orig_tokens,
            pruned_tokens=pruned_tokens,
            tokens_saved_pct=saved_pct,
            intent_preserved=True,
            constraints_pass=True,
            held_out_noninferior=True,
            adversarial_pass=False,
            status=CompressionStatus.REJECTED_ADVERSARIAL_FAILED,
            evidence_trail=trail,
        )
    trail.append("Adversarial regression suite: PASS")
    trail.append("All gates passed: Candidate PROMOTABLE")

    return CompressionCandidate(
        original_prompt=original_prompt,
        pruned_prompt=pruned_prompt,
        original_tokens=orig_tokens,
        pruned_tokens=pruned_tokens,
        tokens_saved_pct=saved_pct,
        intent_preserved=True,
        constraints_pass=True,
        held_out_noninferior=True,
        adversarial_pass=True,
        status=CompressionStatus.PROMOTABLE,
        evidence_trail=trail,
    )
