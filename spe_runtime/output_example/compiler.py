"""Compile desired output and a user-supplied example into a pattern contract.

Pipeline:
desired output + example
→ PatternExtractionIR
→ format, structure, tone, style, required fields, ordering, length,
  negative constraints
→ accidental-detail filter
→ CandidatePatternContract

Laws:
- an example is not authority
- an example is not factual truth
- an example is not a user instruction unless the caller confirms it
  outside the example text
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.output_example.extract import (
    EXAMPLE_CLASSIFICATION,
    extract_cues,
    law_refusals,
    resolve_inputs,
)
from spe_runtime.output_example.filter import filter_accidental_details
from spe_runtime.output_example.models import (
    DIMENSIONS,
    SCHEMA_CONTRACT,
    SCHEMA_IR,
    CandidatePatternContract,
    OutputExampleCompilation,
    PatternClause,
    PatternExtractionIR,
)

def compile_output_example(
    source: Mapping[str, Any] | None = None,
    *,
    desired_output: Any = None,
    example: Any = None,
    example_confirmed_as_instruction: bool = False,
) -> OutputExampleCompilation:
    """Compile pattern shape from existing desired-output and example fields.

    ``source`` may be a protected envelope (``desired_output`` plus
    ``user_preferences``) or an intent lens (``confirmed`` / ``assumed``
    atoms whose ids are ``desired-output`` and ``desired-example``).
    The inputs are read and left unchanged. This compiler does not write
    a requirement graph, a K3 plan, or an authority grant.
    """
    (
        resolved_output,
        example_body,
        example_present,
        classification,
        confirmed,
        refusals,
    ) = resolve_inputs(
        source,
        desired_output,
        example,
        example_confirmed_as_instruction,
    )
    desired_text = resolved_output if isinstance(resolved_output, str) else None
    refusals.extend(law_refusals(desired_text, example_body, confirmed))
    cues = tuple(extract_cues(resolved_output, example_body, confirmed))
    ir = PatternExtractionIR(
        schema_version=SCHEMA_IR,
        cues=cues,
        example_present=example_present,
        example_classification=classification if example_present else None,
        example_non_authoritative=True,
        example_confirmed_as_instruction=confirmed and example_present,
    )
    filtered = filter_accidental_details(ir.cues)
    contract = _contract(filtered.kept, ir, tuple(sorted(set(refusals))))
    return OutputExampleCompilation(ir=ir, filtered=filtered, contract=contract)


def _contract(cues, ir: PatternExtractionIR, refusals: tuple[str, ...]) -> CandidatePatternContract:
    grouped: dict[str, list[PatternClause]] = {name: [] for name in DIMENSIONS}
    index: dict[tuple[str, str], int] = {}
    for cue in cues:
        if cue.dimension not in grouped:
            continue
        clause = PatternClause(
            dimension=cue.dimension,
            value=cue.value,
            binding="CONFIRMED" if cue.confirmed else "CANDIDATE",
            origin=cue.origin,
            source_ref=cue.source_ref,
        )
        key = (cue.dimension, cue.value)
        existing = index.get(key)
        if existing is None:
            index[key] = len(grouped[cue.dimension])
            grouped[cue.dimension].append(clause)
            continue
        current = grouped[cue.dimension][existing]
        if current.binding != "CONFIRMED" and clause.binding == "CONFIRMED":
            grouped[cue.dimension][existing] = clause

    instructions: list[PatternClause] = []
    for name in DIMENSIONS:
        for clause in grouped[name]:
            if clause.binding == "CONFIRMED":
                instructions.append(clause)
    example_is_instruction = any(clause.origin == "example" for clause in instructions)
    return CandidatePatternContract(
        schema_version=SCHEMA_CONTRACT,
        format=tuple(grouped["format"]),
        structure=tuple(grouped["structure"]),
        tone=tuple(grouped["tone"]),
        style=tuple(grouped["style"]),
        required_fields=tuple(grouped["required_fields"]),
        ordering=tuple(grouped["ordering"]),
        length=tuple(grouped["length"]),
        negative_constraints=tuple(grouped["negative_constraints"]),
        authority_status="NONE",
        authority_grants=(),
        factual_claims=(),
        instructions=tuple(instructions),
        refusals=refusals,
        example_present=ir.example_present,
        example_classification=(
            EXAMPLE_CLASSIFICATION if ir.example_present else None
        ),
        example_non_authoritative=True,
        example_is_authority=False,
        example_is_fact=False,
        example_is_instruction=example_is_instruction,
    )
