"""
SPE Ω PRO — Compounding Research Capability Lifecycle (RGD-1)
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
import json
from typing import Dict, List, Optional, Tuple, Any
from spe_runtime.research.rgd.types import CompoundingProcedure


def compute_procedure_seal(
    procedure_id: str,
    domain: str,
    name: str,
    assumptions: List[str],
    verdict: str,
    savings: float,
) -> str:
    """Computes deterministic SHA-256 seal for a compounding procedure state."""
    seal_payload = {
        "procedure_id": procedure_id,
        "domain": domain,
        "name": name,
        "assumptions": sorted(assumptions),
        "verdict": verdict,
        "savings": savings,
    }
    return hashlib.sha256(json.dumps(seal_payload, sort_keys=True).encode("utf-8")).hexdigest()


def verify_procedure_seal(proc: CompoundingProcedure) -> bool:
    """Verifies that a compounding procedure's cryptographic seal matches its current state."""
    expected = compute_procedure_seal(
        procedure_id=proc.procedure_id,
        domain=proc.domain,
        name=proc.name,
        assumptions=proc.assumptions,
        verdict=proc.qualification_verdict,
        savings=proc.cost_savings_pct,
    )
    return proc.sha256_seal == expected


class CompoundingCapabilityRegistry:
    """
    Manages the lifecycle of reusable verified scientific research capabilities.
    Integrates with WDIC (procedure compilation), CSC (assumption attack),
    LVT (transfer gates), and EGAC (adaptive compute cost efficiency).
    """

    def __init__(self):
        self._procedures: Dict[str, CompoundingProcedure] = {}
        self._seed_canonical_procedures()

    def _seed_canonical_procedures(self) -> None:
        p1 = self.register_procedure(
            domain="AUDIO_ENGINEERING",
            name="Reproducible Neural Codec ViSQOL & PESQ Evaluation Protocol",
            assumptions=[
                "ViSQOL v3.1 binary present on local device",
                "VCTK test partition speech corpus clean sample rate == 48000Hz",
                "Non-intrusive SNR threshold >= 15dB",
            ],
            tested_tasks_count=5,
            lvt_transfer_passed=True,
            csc_boundary_passed=True,
            cost_savings_pct=52.0,
        )
        p2 = self.register_procedure(
            domain="BIOTECHNOLOGY",
            name="De Novo Surface Monomericity Light-Scattering Screening Pipeline",
            assumptions=[
                "SEC-MALS refractive index increment dn/dc == 0.185 mL/g",
                "Recombinant expression in standard PBS buffer pH 7.4",
                "Absence of non-specific sensor chip dextran binding",
            ],
            tested_tasks_count=4,
            lvt_transfer_passed=True,
            csc_boundary_passed=True,
            cost_savings_pct=48.5,
        )
        self._procedures[p1.procedure_id] = p1
        self._procedures[p2.procedure_id] = p2

    def register_procedure(
        self,
        domain: str,
        name: str,
        assumptions: List[str],
        tested_tasks_count: int,
        lvt_transfer_passed: bool,
        csc_boundary_passed: bool,
        cost_savings_pct: float,
    ) -> CompoundingProcedure:
        """
        Registers a newly discovered procedure after passing LVT and CSC qualification.
        """
        procedure_id = f"proc_{hashlib.sha256((domain + name).encode('utf-8')).hexdigest()[:10]}"

        if not lvt_transfer_passed or not csc_boundary_passed:
            verdict = "REJECTED_UNQUALIFIED"
            is_valid = False
            invalidation_reason = "Failed LVT transfer trial or CSC adversarial boundary probe."
        else:
            verdict = "QUALIFIED_REUSABLE_CAPABILITY"
            is_valid = True
            invalidation_reason = None

        seal = compute_procedure_seal(
            procedure_id=procedure_id,
            domain=domain,
            name=name,
            assumptions=assumptions,
            verdict=verdict,
            savings=cost_savings_pct,
        )

        procedure = CompoundingProcedure(
            procedure_id=procedure_id,
            domain=domain,
            name=name,
            qualification_verdict=verdict,
            tested_tasks_count=tested_tasks_count,
            assumptions=assumptions,
            is_valid=is_valid,
            invalidation_reason=invalidation_reason,
            cost_savings_pct=cost_savings_pct,
            sha256_seal=seal,
        )
        self._procedures[procedure_id] = procedure
        return procedure

    def get_procedure(self, procedure_id: str) -> Optional[CompoundingProcedure]:
        return self._procedures.get(procedure_id)

    def get_all_procedures(self) -> List[CompoundingProcedure]:
        return list(self._procedures.values())

    def find_valid_procedure_for_domain(self, domain: str) -> Optional[CompoundingProcedure]:
        for proc in self._procedures.values():
            if proc.domain == domain and proc.is_valid:
                return proc
        return None

    def invalidate_assumption(
        self,
        procedure_id: str,
        broken_assumption_substring: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Automatically invalidates a previously qualified procedure if any underlying assumption breaks.
        Recomputes cryptographic seal to reflect the invalidated state.
        """
        proc = self._procedures.get(procedure_id)
        if not proc:
            return False, "Procedure not found"

        matched = [a for a in proc.assumptions if broken_assumption_substring.lower() in a.lower()]
        if not matched:
            return False, "No matching assumption found"

        proc.is_valid = False
        proc.invalidation_reason = f"Assumption invalidated: '{matched[0]}' failed empirical verification."
        proc.qualification_verdict = "INVALIDATED_REQUIRES_REQUALIFICATION"
        proc.sha256_seal = compute_procedure_seal(
            procedure_id=proc.procedure_id,
            domain=proc.domain,
            name=proc.name,
            assumptions=proc.assumptions,
            verdict=proc.qualification_verdict,
            savings=proc.cost_savings_pct,
        )
        return True, proc.invalidation_reason

    def requalify_procedure(
        self,
        procedure_id: str,
        lvt_transfer_passed: bool,
        csc_boundary_passed: bool,
    ) -> Tuple[bool, str]:
        """
        Requalifies an invalidated procedure through authentic LVT and CSC tests.
        Recomputes cryptographic seal upon successful qualification.
        """
        proc = self._procedures.get(procedure_id)
        if not proc:
            return False, "Procedure not found"

        if lvt_transfer_passed and csc_boundary_passed:
            proc.is_valid = True
            proc.invalidation_reason = None
            proc.qualification_verdict = "QUALIFIED_REUSABLE_CAPABILITY"
            proc.tested_tasks_count += 1
            proc.sha256_seal = compute_procedure_seal(
                procedure_id=proc.procedure_id,
                domain=proc.domain,
                name=proc.name,
                assumptions=proc.assumptions,
                verdict=proc.qualification_verdict,
                savings=proc.cost_savings_pct,
            )
            return True, "Procedure successfully requalified under LVT."
        else:
            return False, "Requalification failed: Transfer tests or boundary probes did not pass."
