"""SPE Ω — Intent Loss Detector (ILD) Python Runtime
Crown Breakthrough Capability #1

Epistemic Grounding:
- ST-WebAgentBench (ICLR 2026): Policy compliance vs nominal task completion
- Measuring Intent Comprehension in LLMs (2025)
- Counterfactual Specification Closure (CSC) & Kleene-3 Monotone Lattice
"""

from __future__ import annotations
import re
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

NEGATIVE_PATTERNS = [
    re.compile(r"\b(must\s+not|must\s+never)\s+([^.,;\n]+)", re.IGNORECASE),
    re.compile(r"\b(never|do\s+not|don't|cannot|can't)\s+([^.,;\n]+)", re.IGNORECASE),
    re.compile(r"\b(forbidden|prohibited|disallowed):\s*([^.,;\n]+)", re.IGNORECASE),
    re.compile(r"\b(avoid|refrain\s+from)\s+([^.,;\n]+)", re.IGNORECASE),
    re.compile(r"\bwithout\s+(using\s+|adding\s+|any\s+)?([^.,;\n]+)", re.IGNORECASE),
    re.compile(r"\bno\s+(external|eval|dependencies|inline|telemetry|cloud|tracking|leakage)\b([^.,;\n]*)", re.IGNORECASE),
]

BOUNDARY_PATTERNS = [
    re.compile(r"\b(air-?gap|offline|zero\s+cloud|100%\s+local)\b", re.IGNORECASE),
    re.compile(r"\b(token\s+budget|token\s+limit|max\s+tokens?|under\s+\d+\s+tokens?)\b", re.IGNORECASE),
    re.compile(r"\b(latency\s*<\s*\d+|under\s+\d+ms|fast|real-?time)\b", re.IGNORECASE),
    re.compile(r"\b(memory\s+budget|under\s+\d+mb)\b", re.IGNORECASE),
]

FORMAT_PATTERNS = [
    re.compile(r"\b(json\s+only|valid\s+json|strict\s+json|rfc\s+8785)\b", re.IGNORECASE),
    re.compile(r"\b(markdown\s+table|markdown\s+only)\b", re.IGNORECASE),
    re.compile(r"\b(typescript|pure\s+css|vanilla\s+js)\b", re.IGNORECASE),
]

OPTIONAL_PATTERNS = [
    re.compile(r"\b(optional|prefer|if\s+possible|nice\s+to\s+have|ideally|could\s+also)\b", re.IGNORECASE),
]

STOP_WORDS = {"the", "and", "for", "with", "that", "this", "from", "must", "should"}


@dataclass
class ExtractedRequirement:
    id: str
    category: str  # "NEGATIVE_CONSTRAINT", "MANDATORY_POSITIVE", "BOUNDARY_CONDITION", "FORMAT_CONSTRAINT", "OPTIONAL_PREFERENCE"
    original_text: str
    normalized_subject: str
    normalized_predicate: str
    is_negative: bool
    criticality: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    forbidden_keywords: List[str] = field(default_factory=list)
    required_keywords: List[str] = field(default_factory=list)
    source_origin: str = "USER_INPUT"


@dataclass
class IntentLossFinding:
    requirement_id: str
    requirement: ExtractedRequirement
    state: str  # "PRESERVED", "DROPPED", "WEAKENED", "CONTRADICTED", "UNCERTAIN"
    severity: str  # "CRITICAL_INTENT_LOSS", "HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT", "MODERATE_OPTIONAL_DEGRADATION", "ZERO_LOSS"
    confidence: float
    evidence_excerpt: str
    explanation: str
    remediation_prompt_patch: str


@dataclass
class IntentLossReport:
    timestamp: str
    source_intent_hash: str
    synthesized_prompt_hash: str
    total_requirements: int
    preserved_count: int
    dropped_count: int
    weakened_count: int
    contradicted_count: int
    dropped_negative_constraints: int
    fidelity_score: float
    passed: bool
    critical_defects_detected: bool
    findings: List[IntentLossFinding]
    restoration_suggestion: Dict[str, Any]


class RequirementExtractorPy:
    """Extracts atomic user requirements and negative constraints."""

    def extract_from_text(self, raw_text: str, origin: str = "USER_INPUT") -> List[ExtractedRequirement]:
        if not raw_text or not raw_text.strip():
            return []

        clauses = [
            c.strip()
            for c in re.split(r"[\n;•\u2022]|\band\s+also\b", raw_text, flags=re.IGNORECASE)
            if len(c.strip()) > 3
        ]

        requirements: List[ExtractedRequirement] = []
        for idx, clause in enumerate(clauses, start=1):
            lower = clause.lower()

            is_negative = (
                any(p.search(clause) for p in NEGATIVE_PATTERNS)
                or "must not" in lower
                or "never" in lower
                or "forbidden" in lower
                or lower.startswith("no ")
                or "do not" in lower
            )

            category = "MANDATORY_POSITIVE"
            criticality = "HIGH"

            if is_negative:
                category = "NEGATIVE_CONSTRAINT"
                criticality = "CRITICAL"
            elif any(p.search(clause) for p in BOUNDARY_PATTERNS):
                category = "BOUNDARY_CONDITION"
                criticality = "CRITICAL"
            elif any(p.search(clause) for p in FORMAT_PATTERNS):
                category = "FORMAT_CONSTRAINT"
                criticality = "HIGH"
            elif any(p.search(clause) for p in OPTIONAL_PATTERNS):
                category = "OPTIONAL_PREFERENCE"
                criticality = "MEDIUM"

            words = [
                w
                for w in re.sub(r"[^a-z0-9_\-\s]", " ", lower).split()
                if len(w) > 2 and w not in STOP_WORDS
            ]

            requirements.append(
                ExtractedRequirement(
                    id=f"req-{idx:03d}",
                    category=category,
                    original_text=clause,
                    normalized_subject=" ".join(words[:3]) or clause,
                    normalized_predicate=clause,
                    is_negative=is_negative,
                    criticality=criticality,
                    forbidden_keywords=words if is_negative else [],
                    required_keywords=[] if is_negative else words,
                    source_origin=origin,
                )
            )

        return requirements


class IntentLossDetectorPy:
    """Evaluates synthesized prompt against original user requirements."""

    def __init__(self) -> None:
        self.extractor = RequirementExtractorPy()

    def evaluate_intent_fidelity(
        self,
        source_requirements: str | List[ExtractedRequirement],
        synthesized_prompt: str,
    ) -> IntentLossReport:
        if isinstance(source_requirements, str):
            requirements = self.extractor.extract_from_text(source_requirements)
        else:
            requirements = source_requirements

        lower_prompt = synthesized_prompt.lower()
        findings: List[IntentLossFinding] = []

        preserved_count = 0
        dropped_count = 0
        weakened_count = 0
        contradicted_count = 0
        dropped_negative_constraints = 0

        for req in requirements:
            finding = self._evaluate_single(req, lower_prompt)
            findings.append(finding)

            if finding.state == "PRESERVED":
                preserved_count += 1
            elif finding.state == "DROPPED":
                dropped_count += 1
                if req.is_negative:
                    dropped_negative_constraints += 1
            elif finding.state == "WEAKENED":
                weakened_count += 1
            elif finding.state == "CONTRADICTED":
                contradicted_count += 1
                if req.is_negative:
                    dropped_negative_constraints += 1
            elif finding.state == "UNCERTAIN":
                dropped_count += 1

        total = len(requirements)
        fidelity = 1.0
        if total > 0:
            raw_score = (
                preserved_count * 1.0
                + weakened_count * 0.5
                - dropped_count * 0.8
                - contradicted_count * 1.2
            ) / total
            fidelity = max(0.0, min(1.0, round(raw_score, 2)))

        critical_defects = dropped_negative_constraints > 0 or contradicted_count > 0
        passed = (not critical_defects) and (fidelity >= 0.80)

        missing_items = [
            f.requirement
            for f in findings
            if f.state in ("DROPPED", "CONTRADICTED", "WEAKENED")
        ]

        reconstructed_rules = [
            f"[CRITICAL_BOUNDARY] {r.original_text}"
            if r.is_negative
            else f"[MANDATORY_REQUIREMENT] {r.original_text}"
            for r in missing_items
        ]

        patch_block = (
            f"\n\n<restored_intent_safeguards>\n"
            + "\n".join(reconstructed_rules)
            + "\n</restored_intent_safeguards>"
            if reconstructed_rules
            else ""
        )

        return IntentLossReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            source_intent_hash=hashlib.sha256(
                repr([r.original_text for r in requirements]).encode()
            ).hexdigest()[:16],
            synthesized_prompt_hash=hashlib.sha256(
                synthesized_prompt.encode()
            ).hexdigest()[:16],
            total_requirements=total,
            preserved_count=preserved_count,
            dropped_count=dropped_count,
            weakened_count=weakened_count,
            contradicted_count=contradicted_count,
            dropped_negative_constraints=dropped_negative_constraints,
            fidelity_score=fidelity,
            passed=passed,
            critical_defects_detected=critical_defects,
            findings=findings,
            restoration_suggestion={
                "recommended_action": (
                    "Intent preserved with high fidelity. No remediation needed."
                    if passed
                    else f"Remediate {len(missing_items)} dropped/contradicted requirements immediately before execution."
                ),
                "restored_prompt": synthesized_prompt + patch_block,
                "reconstructed_rules": reconstructed_rules,
            },
        )

    def _evaluate_single(
        self, req: ExtractedRequirement, lower_prompt: str
    ) -> IntentLossFinding:
        if req.is_negative:
            return self._evaluate_negative(req, lower_prompt)
        return self._evaluate_positive(req, lower_prompt)

    def _evaluate_negative(
        self, req: ExtractedRequirement, lower_prompt: str
    ) -> IntentLossFinding:
        neg_markers = [
            "must not", "never", "do not", "don't", "cannot", "forbidden",
            "prohibited", "avoid", "no ", "without"
        ]
        forbidden_targets = [
            w for w in req.forbidden_keywords
            if w not in ("must", "not", "never", "don", "t", "do", "forbidden", "avoid")
        ]

        prohibition_found = False
        explicit_violation = False

        clauses = re.split(r"[\n.;]", lower_prompt)
        for c in clauses:
            if any(m in c for m in neg_markers) and any(w in c for w in forbidden_targets):
                prohibition_found = True
                break

        permissive_markers = ["use ", "import ", "include ", "enable ", "call ", "allow "]
        for c in clauses:
            if any(p in c for p in permissive_markers) and any(w in c for w in forbidden_targets):
                if not any(m in c for m in neg_markers):
                    explicit_violation = True
                    break

        if explicit_violation:
            return IntentLossFinding(
                requirement_id=req.id,
                requirement=req,
                state="CONTRADICTED",
                severity="CRITICAL_INTENT_LOSS",
                confidence=0.98,
                evidence_excerpt=f"Negative constraint contradicted: output permits [{req.original_text}].",
                explanation=f"User explicitly forbade [{req.original_text}], but prompt permits or instructs it.",
                remediation_prompt_patch=f"STRICT PROHIBITION: Never under any circumstances {req.original_text}.",
            )

        if prohibition_found:
            return IntentLossFinding(
                requirement_id=req.id,
                requirement=req,
                state="PRESERVED",
                severity="ZERO_LOSS",
                confidence=0.95,
                evidence_excerpt="Negative constraint verified present in generated prompt.",
                explanation=f"Prohibition against [{', '.join(forbidden_targets)}] is preserved.",
                remediation_prompt_patch="",
            )

        return IntentLossFinding(
            requirement_id=req.id,
            requirement=req,
            state="DROPPED",
            severity="HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT",
            confidence=0.92,
            evidence_excerpt=f"Negative constraint dropped: no prohibition against [{req.original_text}] appears.",
            explanation=f"User explicitly required [{req.original_text}], but this safeguard was lost during synthesis.",
            remediation_prompt_patch=f"MANDATORY BOUNDARY: Do not {req.original_text}.",
        )

    def _evaluate_positive(
        self, req: ExtractedRequirement, lower_prompt: str
    ) -> IntentLossFinding:
        target_words = [
            w for w in req.required_keywords
            if len(w) > 3 and w not in ("must", "shall", "always", "require", "ensure", "should")
        ]

        if not target_words:
            return IntentLossFinding(
                requirement_id=req.id,
                requirement=req,
                state="PRESERVED",
                severity="ZERO_LOSS",
                confidence=0.85,
                evidence_excerpt="General requirement matched.",
                explanation="Requirement matched base prompt structure.",
                remediation_prompt_patch="",
            )

        matched_words = [w for w in target_words if w in lower_prompt]
        match_ratio = len(matched_words) / len(target_words)

        weakening_markers = [
            "optional", "if preferred", "consider", "you may optionally", "not strictly required"
        ]
        clauses = re.split(r"[\n.;]", lower_prompt)
        is_weakened = any(
            any(wm in c for wm in weakening_markers) and any(w in c for w in matched_words)
            for c in clauses
        )

        if is_weakened:
            return IntentLossFinding(
                requirement_id=req.id,
                requirement=req,
                state="WEAKENED",
                severity="MODERATE_OPTIONAL_DEGRADATION",
                confidence=0.88,
                evidence_excerpt=f"Requirement softened: [{req.original_text}] demoted to optional.",
                explanation=f"User mandated [{req.original_text}], but output treated it as an optional recommendation.",
                remediation_prompt_patch=f"MANDATORY INSTRUCTION: You must strictly adhere to: {req.original_text}.",
            )

        if match_ratio >= 0.5:
            return IntentLossFinding(
                requirement_id=req.id,
                requirement=req,
                state="PRESERVED",
                severity="ZERO_LOSS",
                confidence=0.90 + match_ratio * 0.1,
                evidence_excerpt=f"Matched concepts: {', '.join(matched_words)}",
                explanation=f"Requirement [{req.original_text}] preserved in prompt.",
                remediation_prompt_patch="",
            )

        return IntentLossFinding(
            requirement_id=req.id,
            requirement=req,
            state="DROPPED",
            severity="CRITICAL_INTENT_LOSS" if req.criticality == "CRITICAL" else "MODERATE_OPTIONAL_DEGRADATION",
            confidence=0.86,
            evidence_excerpt=f"Missing required concepts: {', '.join(w for w in target_words if w not in matched_words)}",
            explanation=f"Requirement [{req.original_text}] was completely dropped during prompt generation.",
            remediation_prompt_patch=f"MANDATORY REQUIREMENT: {req.original_text}.",
        )
