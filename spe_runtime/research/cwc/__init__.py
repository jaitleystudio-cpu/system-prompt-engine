"""
SPE Ω PRO — CWC-1 (Counterfactual Witness Compilation) Package.
Frontier Scientific Intelligence, Mechanism Identification & Epistemic Verification.
"""

from .types import (
    MechanismClass,
    IdentifiabilityStatus,
    ScientificWitnessType,
    QualificationState,
    ExplanatoryMechanism,
    InterventionalAction,
    PrecommitmentDigest,
    ObservationWitness,
    ScientificWitness,
    ReusableScientificProcedure,
    Cwc1Result,
    ProductivityCalculationStatus,
    PriorSensitivityReport,
    DiscriminatoryPowerReport,
    PreregistrationChainEntry,
    AcquisitionMode,
    StatisticalProtocol,
)
from .mechanism_compiler import MechanismCompiler
from .experiment_selector import ExperimentSelector, PreregistrationLedger
from .witness_generator import ScientificWitnessGenerator
from .transfer_engine import TransferEngine
from .engine import SpeCwcEngine

__all__ = [
    "MechanismClass",
    "IdentifiabilityStatus",
    "ScientificWitnessType",
    "QualificationState",
    "ExplanatoryMechanism",
    "InterventionalAction",
    "PrecommitmentDigest",
    "ObservationWitness",
    "ScientificWitness",
    "ReusableScientificProcedure",
    "Cwc1Result",
    "ProductivityCalculationStatus",
    "PriorSensitivityReport",
    "DiscriminatoryPowerReport",
    "PreregistrationChainEntry",
    "AcquisitionMode",
    "StatisticalProtocol",
    "MechanismCompiler",
    "ExperimentSelector",
    "PreregistrationLedger",
    "ScientificWitnessGenerator",
    "TransferEngine",
    "SpeCwcEngine",
]

