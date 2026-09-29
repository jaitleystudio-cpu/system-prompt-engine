"""Immutable records for the desired-output and example compiler.

The contract can describe shape. It cannot mint authority or record facts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

SCHEMA_IR = "spe.pattern-extraction-ir.v1"
SCHEMA_CONTRACT = "spe.candidate-pattern-contract.v1"

DIMENSIONS = (
    "format",
    "structure",
    "tone",
    "style",
    "required_fields",
    "ordering",
    "length",
    "negative_constraints",
)


@dataclass(frozen=True)
class ExtractedCue:
    """One observed pattern cue or one accidental instance detail."""

    dimension: str
    value: str
    origin: str
    source_ref: str
    evidence: str
    confirmed: bool
    accidental: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "dimension": self.dimension,
            "value": self.value,
            "origin": self.origin,
            "source_ref": self.source_ref,
            "evidence": self.evidence,
            "confirmed": self.confirmed,
            "accidental": self.accidental,
        }


@dataclass(frozen=True)
class PatternExtractionIR:
    """Pattern cues before the accidental-detail filter."""

    schema_version: str
    cues: tuple[ExtractedCue, ...]
    example_present: bool
    example_classification: str | None
    example_non_authoritative: bool
    example_confirmed_as_instruction: bool

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_IR:
            raise ValueError("unexpected pattern extraction schema")
        if not self.example_non_authoritative:
            raise ValueError("example cannot be authoritative")
        object.__setattr__(self, "cues", tuple(self.cues))


@dataclass(frozen=True)
class FilteredPatterns:
    """Kept pattern cues and the instance details the filter removed."""

    kept: tuple[ExtractedCue, ...]
    dropped: tuple[ExtractedCue, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "kept", tuple(self.kept))
        object.__setattr__(self, "dropped", tuple(self.dropped))


@dataclass(frozen=True)
class PatternClause:
    """One dimension of a candidate pattern."""

    dimension: str
    value: str
    binding: str
    origin: str
    source_ref: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "dimension": self.dimension,
            "value": self.value,
            "binding": self.binding,
            "origin": self.origin,
            "source_ref": self.source_ref,
        }


@dataclass(frozen=True)
class CandidatePatternContract:
    """Shape contract compiled from desired output and an optional example.

    ``instructions`` holds confirmed clauses only. Example clauses stay
    candidates until the caller confirms them outside the example text.
    Authority grants and factual claims are always empty.
    """

    schema_version: str
    format: tuple[PatternClause, ...]
    structure: tuple[PatternClause, ...]
    tone: tuple[PatternClause, ...]
    style: tuple[PatternClause, ...]
    required_fields: tuple[PatternClause, ...]
    ordering: tuple[PatternClause, ...]
    length: tuple[PatternClause, ...]
    negative_constraints: tuple[PatternClause, ...]
    authority_status: str
    authority_grants: tuple[str, ...]
    factual_claims: tuple[str, ...]
    instructions: tuple[PatternClause, ...]
    refusals: tuple[str, ...]
    example_present: bool
    example_classification: str | None
    example_non_authoritative: bool
    example_is_authority: bool
    example_is_fact: bool
    example_is_instruction: bool

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_CONTRACT:
            raise ValueError("unexpected candidate pattern schema")
        if self.authority_status != "NONE" or self.authority_grants or self.example_is_authority:
            raise ValueError("example cannot become authority")
        if self.factual_claims or self.example_is_fact:
            raise ValueError("example cannot become factual truth")
        if not self.example_non_authoritative:
            raise ValueError("example must stay non-authoritative")
        if any(clause.binding != "CONFIRMED" for clause in self.instructions):
            raise ValueError("unconfirmed example text is not an instruction")
        if self.example_is_instruction and not any(
            clause.origin == "example" for clause in self.instructions
        ):
            raise ValueError("example is an instruction only when a confirmed pattern exists")
        for name in DIMENSIONS:
            clauses = tuple(getattr(self, name))
            object.__setattr__(self, name, clauses)
            for clause in clauses:
                if clause.dimension != name:
                    raise ValueError(f"{name} contains a {clause.dimension} clause")
        object.__setattr__(self, "instructions", tuple(self.instructions))
        object.__setattr__(self, "refusals", tuple(self.refusals))
        object.__setattr__(self, "authority_grants", tuple(self.authority_grants))
        object.__setattr__(self, "factual_claims", tuple(self.factual_claims))

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "format": [clause.to_dict() for clause in self.format],
            "structure": [clause.to_dict() for clause in self.structure],
            "tone": [clause.to_dict() for clause in self.tone],
            "style": [clause.to_dict() for clause in self.style],
            "required_fields": [clause.to_dict() for clause in self.required_fields],
            "ordering": [clause.to_dict() for clause in self.ordering],
            "length": [clause.to_dict() for clause in self.length],
            "negative_constraints": [
                clause.to_dict() for clause in self.negative_constraints
            ],
            "authority_status": self.authority_status,
            "authority_grants": list(self.authority_grants),
            "factual_claims": list(self.factual_claims),
            "instructions": [clause.to_dict() for clause in self.instructions],
            "refusals": list(self.refusals),
            "example_present": self.example_present,
            "example_classification": self.example_classification,
            "example_non_authoritative": self.example_non_authoritative,
            "example_is_authority": self.example_is_authority,
            "example_is_fact": self.example_is_fact,
            "example_is_instruction": self.example_is_instruction,
        }


@dataclass(frozen=True)
class OutputExampleCompilation:
    """The three pipeline stages: extract, filter, contract."""

    ir: PatternExtractionIR
    filtered: FilteredPatterns
    contract: CandidatePatternContract
