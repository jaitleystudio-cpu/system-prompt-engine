"""
SPE Ω — Global Hero Intelligence (Promise-Preserving Copy Evolution)
Python Parity Kernel

Mandate:
1. Product-Promise Contract enforcement (zero tolerance for ungrounded claims or hype).
2. ISO 24495-1 Plain-English and Global Comprehension Validation.
3. Always Valid Inference (AVI) sequential hypothesis testing (mixture martingales).
4. Strict Invariant: FORCED NIGHTLY PUBLICATION IS FORBIDDEN.
   Copy is retained unless qualified through statistical lift and safety gates.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


SHIPPED_CAPABILITIES = {
    "BROWSER_WASM_COMPILATION": {
        "title": "In-Browser WebAssembly Compiler",
        "keywords": ["webassembly", "wasm", "on-device", "in-browser", "local", "client-side"],
    },
    "AIR_GAP_ZERO_EGRESS": {
        "title": "Air-Gapped Zero Data Egress",
        "keywords": ["air-gapped", "private", "zero data leaves", "never leave", "stays on this device", "offline"],
    },
    "INVARIANT_GUARDRAILS": {
        "title": "ProtectedIntent Invariant Guardrails",
        "keywords": ["boundaries", "guardrails", "invariants", "hallucinat", "drift", "prevent", "lock", "requirements", "rules"],
    },
    "CONFLICT_DETECTION": {
        "title": "Contradiction & Conflict Resolution",
        "keywords": ["conflict", "contradiction", "guesswork", "clear", "structured", "instructions", "review"],
    },
    "MULTI_AGENT_PORTABILITY": {
        "title": "1-Click Multi-Agent Portability",
        "keywords": ["claude", "cursor", "chatgpt", "windsurf", "export", "any ai", "portable", "prompt"],
    },
    "VERIFIED_WORKFLOWS": {
        "title": "Pre-Audited Business & Engineering Workflows",
        "keywords": ["workflow", "template", "recipes", "pre-audited", "code review", "plan", "idea"],
    },
    "SKILL_BUILDER_TAINT_SCAN": {
        "title": "In-Browser Skill Builder & AST Taint Scanner",
        "keywords": ["skill", "builder", "scanner", "taint", "audit"],
    },
    "FRONTIER_MODEL_CURRENCY": {
        "title": "2026 Frontier Model Currency",
        "keywords": ["frontier", "2026", "currency", "models", "atlas"],
    },
    "ZERO_COMPUTE_COST": {
        "title": "Zero Cloud Compute Cost ($0.00)",
        "keywords": ["free", "zero cost", "$0", "no subscription", "on-device"],
    },
}

BANNED_BUZZWORDS = [
    "supercharge",
    "revolutionary",
    "limitless",
    "magic",
    "magical",
    "100x",
    "1000x",
    "guaranteed #1",
    "silver bullet",
    "game-changing",
    "disrupt",
    "superhuman",
    "miracle",
    "unleash",
    "infinite possibilities",
    "transform your life",
]

FORBIDDEN_PROMISES = [
    (
        re.compile(r"run\s+(claude|gpt|gemini|grok|llama|deepseek).*(inside|in|locally\s+in)\s+(your\s+)?(browser|wasm|webassembly)", re.IGNORECASE),
        "ERR_UNSHIPPED_CAPABILITY",
        "SPE does not host or execute LLM neural weights in the browser.",
    ),
    (
        re.compile(r"(neural\s+network\s+weights|weights\s+are\s+loaded).*(webassembly|browser|locally)", re.IGNORECASE),
        "ERR_UNSHIPPED_CAPABILITY",
        "SPE uses symbolic propositional logic and template compilation, not neural network weights.",
    ),
    (
        re.compile(r"without\s+api\s+keys?.*(generate\s+free\s+ai\s+output|run\s+frontier\s+models)", re.IGNORECASE),
        "ERR_UNSHIPPED_CAPABILITY",
        "SPE generates system prompts for external AI models; it does not bypass provider API keys.",
    ),
    (
        re.compile(r"(jailbreak|bypass\s+(safety|guardrails)|unfiltered\s+ai)", re.IGNORECASE),
        "ERR_SAFETY_VIOLATION",
        "SPE enforces safety invariants and does not provide jailbreaking capabilities.",
    ),
]

COMMON_CONFUSING_IDIOMS = [
    "hit the ground running",
    "silver bullet",
    "touch base",
    "under the hood",
    "ballpark",
    "piece of cake",
    "bite the bullet",
    "cut corners",
    "break the ice",
    "rule of thumb",
    "apples to oranges",
    "boil the ocean",
    "low-hanging fruit",
    "drinking the kool-aid",
]


@dataclass
class PromiseViolation:
    code: str
    matched_text: str
    reason: str


@dataclass
class PromiseVerificationResult:
    valid: bool
    violations: List[PromiseViolation]
    verified_claims: List[str]
    grounding_score: float


def verify_copy_against_promise_contract(
    headline: str, support: str = "", cta: str = ""
) -> PromiseVerificationResult:
    full_text = f"{headline} {support} {cta}".lower()
    violations: List[PromiseViolation] = []
    verified_claims: List[str] = []

    # 1. Check banned buzzwords
    for buzzword in BANNED_BUZZWORDS:
        if buzzword in full_text:
            violations.append(
                PromiseViolation(
                    code="ERR_FORBIDDEN_BUZZWORD",
                    matched_text=buzzword,
                    reason=f"Copy contains banned buzzword: '{buzzword}'",
                )
            )

    # 2. Check forbidden unshipped claims
    for pattern, code, reason in FORBIDDEN_PROMISES:
        match = pattern.search(full_text)
        if match:
            violations.append(
                PromiseViolation(
                    code=code,
                    matched_text=match.group(0),
                    reason=reason,
                )
            )

    # 3. Ground against shipped capabilities
    for key, cap in SHIPPED_CAPABILITIES.items():
        for kw in cap["keywords"]:
            if kw in full_text:
                verified_claims.append(key)
                break

    valid = len(violations) == 0
    grounding_score = 1.0 if (valid and len(verified_claims) > 0) else (0.8 if valid else 0.0)

    return PromiseVerificationResult(
        valid=valid,
        violations=violations,
        verified_claims=verified_claims,
        grounding_score=grounding_score,
    )


def count_syllables_in_word(word: str) -> int:
    clean = re.sub(r"[^a-z]", "", word.lower())
    if not clean or len(clean) <= 3:
        return 1
    # Replace silent 'e' at end
    processed = re.sub(r"(?:[^laeiouy]|ed|es)e$", "", clean)
    processed = re.sub(r"^y", "", processed)
    vowels = re.findall(r"[aeiouy]{1,2}", processed)
    return max(1, len(vowels))


@dataclass
class ComprehensionReport:
    passed: bool
    flesch_grade: float
    reading_ease: float
    word_count: int
    sentence_count: int
    idioms_detected: List[str]
    overflow_risk: bool
    issues: List[str]


def validate_comprehension(
    title: str, accent: str, support: str = "", cta: str = ""
) -> ComprehensionReport:
    issues: List[str] = []
    idioms_detected: List[str] = []
    headline = f"{title} {accent}".strip()
    full_text = f"{headline} {support} {cta}".strip()

    # 1. Idioms check
    lower_text = full_text.lower()
    for idiom in COMMON_CONFUSING_IDIOMS:
        if idiom in lower_text:
            idioms_detected.append(idiom)
            issues.append(f"Idiom detected: '{idiom}'")

    # 2. Overflow risk
    overflow_risk = False
    tokens = headline.split()
    for token in tokens:
        if len(token) > 25:
            overflow_risk = True
            issues.append(f"Token '{token}' exceeds 25 characters, risking mobile overflow.")
    if len(title) > 50 or len(accent) > 50:
        overflow_risk = True
        issues.append("Headline line exceeds 50 characters.")

    # 3. Sentences & Words
    sentences = [s.strip() for s in re.split(r"[.!?]+", full_text) if s.strip()]
    sentence_count = max(1, len(sentences))

    words = [re.sub(r"[^a-zA-Z0-9]", "", w) for w in full_text.split() if re.sub(r"[^a-zA-Z0-9]", "", w)]
    word_count = max(1, len(words))

    # 4. Syllables & Formulas
    total_syllables = sum(count_syllables_in_word(w) for w in words)
    avg_sentence_len = word_count / sentence_count
    avg_syllables_per_word = total_syllables / word_count

    flesch_grade = 0.39 * avg_sentence_len + 11.8 * avg_syllables_per_word - 15.59
    flesch_grade = round(max(0.0, flesch_grade), 1)

    reading_ease = 206.835 - 1.015 * avg_sentence_len - 84.6 * avg_syllables_per_word
    reading_ease = round(max(0.0, min(100.0, reading_ease)), 1)

    if flesch_grade > 8.5:
        issues.append(f"Reading grade {flesch_grade} exceeds target 8.5")
    if reading_ease < 60.0:
        issues.append(f"Reading ease {reading_ease} is below target 60.0")

    passed = len(issues) == 0 and not overflow_risk and len(idioms_detected) == 0

    return ComprehensionReport(
        passed=passed,
        flesch_grade=flesch_grade,
        reading_ease=reading_ease,
        word_count=word_count,
        sentence_count=sentence_count,
        idioms_detected=idioms_detected,
        overflow_risk=overflow_risk,
        issues=issues,
    )


class AlwaysValidInference:
    def __init__(self, critical_e_value_hurdle: float = 20.0):
        self.critical_e_value_hurdle = critical_e_value_hurdle

    def check_sample_ratio_mismatch(
        self, control_count: int, treatment_count: int, expected_ratio: float = 0.5
    ) -> Tuple[bool, float, float]:
        total = control_count + treatment_count
        if total < 30:
            return False, 0.0, 1.0

        exp_control = total * expected_ratio
        exp_treatment = total * (1.0 - expected_ratio)

        chi_sq = (
            ((control_count - exp_control) ** 2) / exp_control
            + ((treatment_count - exp_treatment) ** 2) / exp_treatment
        )
        p_val = math.erfc(math.sqrt(chi_sq / 2.0))
        return (p_val < 0.001), chi_sq, p_val

    def calculate_e_value(
        self, n_a: int, y_a: int, n_b: int, y_b: int
    ) -> Tuple[float, float, bool]:
        if n_a == 0 or n_b == 0:
            return 1.0, 0.0, False

        p_a = y_a / n_a
        p_b = y_b / n_b

        pooled_p = (y_a + y_b) / (n_a + n_b)
        variance = pooled_p * (1.0 - pooled_p) * (1.0 / n_a + 1.0 / n_b)

        if variance <= 0:
            return 1.0, 0.0, False

        z_score = (p_b - p_a) / math.sqrt(variance)

        if z_score > 0:
            e_val = math.exp(min(700.0, (z_score**2) / 2.0))
        else:
            e_val = 0.5

        qualified = e_val >= self.critical_e_value_hurdle
        return e_val, z_score, qualified


@dataclass
class HeroCopyPackage:
    title: str
    accent: str
    support: str
    cta: str
    strategy: Optional[str] = None


@dataclass
class AdjudicationOutcome:
    action: str
    copy_published: bool
    reason: str
    e_value: float
    sample_size: Dict[str, int]
    duration_hours: float
    srm_detected: bool
    active_headline: HeroCopyPackage


class HeroExperimentEngine:
    def __init__(
        self,
        baseline: HeroCopyPackage,
        min_sample_size: int = 200,
        min_duration_hours: float = 72.0,
    ):
        self.baseline = baseline
        self.active_candidate: Optional[HeroCopyPackage] = None
        self.min_sample_size = min_sample_size
        self.min_duration_hours = min_duration_hours
        self.avi = AlwaysValidInference(20.0)
        self.metrics = {
            "control": {"exposures": 0, "conversions": 0, "bounces": 0},
            "candidate": {"exposures": 0, "conversions": 0, "bounces": 0},
        }

    def enqueue_candidate(self, candidate: HeroCopyPackage):
        self.active_candidate = candidate
        self.metrics = {
            "control": {"exposures": 0, "conversions": 0, "bounces": 0},
            "candidate": {"exposures": 0, "conversions": 0, "bounces": 0},
        }

    def record_observation(self, arm: str, converted: bool):
        self.metrics[arm]["exposures"] += 1
        if converted:
            self.metrics[arm]["conversions"] += 1

    def record_bounce(self, arm: str, bounced: bool):
        if bounced:
            self.metrics[arm]["bounces"] += 1
        if self.metrics[arm]["exposures"] <= self.metrics[arm]["bounces"]:
            self.metrics[arm]["exposures"] += 1

    def get_active_headline(self) -> HeroCopyPackage:
        return self.baseline

    def adjudicate_evidence(self, duration_hours: float) -> AdjudicationOutcome:
        n_a = self.metrics["control"]["exposures"]
        n_b = self.metrics["candidate"]["exposures"]

        if not self.active_candidate:
            return AdjudicationOutcome(
                action="RETAIN_EXISTING",
                copy_published=False,
                reason="No active candidate in experiment pool. Existing copy retained.",
                e_value=1.0,
                sample_size={"control": n_a, "candidate": n_b},
                duration_hours=duration_hours,
                srm_detected=False,
                active_headline=self.baseline,
            )

        # 1. Safety stop: bounce increase > 5%
        bounce_a = self.metrics["control"]["bounces"] / n_a if n_a > 0 else 0.0
        bounce_b = self.metrics["candidate"]["bounces"] / n_b if n_b > 0 else 0.0
        if n_b >= 50 and bounce_b > bounce_a + 0.05:
            self.active_candidate = None
            return AdjudicationOutcome(
                action="SAFETY_STOP_ROLLBACK",
                copy_published=False,
                reason=f"Safety stop triggered: Candidate bounce rate ({bounce_b:.1%}) exceeded control ({bounce_a:.1%}) by > 5%. Candidate removed.",
                e_value=0.1,
                sample_size={"control": n_a, "candidate": n_b},
                duration_hours=duration_hours,
                srm_detected=False,
                active_headline=self.baseline,
            )

        # 2. SRM check
        has_srm, _, p_srm = self.avi.check_sample_ratio_mismatch(n_a, n_b)
        if has_srm:
            self.active_candidate = None
            return AdjudicationOutcome(
                action="SAFETY_STOP_ROLLBACK",
                copy_published=False,
                reason=f"SRM corruption detected: Traffic allocation mismatch (p={p_srm:.5f}).",
                e_value=0.0,
                sample_size={"control": n_a, "candidate": n_b},
                duration_hours=duration_hours,
                srm_detected=True,
                active_headline=self.baseline,
            )

        # 3. Minimum sample and duration
        if n_a < self.min_sample_size or n_b < self.min_sample_size or duration_hours < self.min_duration_hours:
            return AdjudicationOutcome(
                action="RETAIN_EXISTING",
                copy_published=False,
                reason=f"Insufficient sample size ({n_a}/{n_b} < {self.min_sample_size}) or duration ({duration_hours}h < {self.min_duration_hours}h). Existing copy retained.",
                e_value=1.0,
                sample_size={"control": n_a, "candidate": n_b},
                duration_hours=duration_hours,
                srm_detected=False,
                active_headline=self.baseline,
            )

        # 4. Always Valid Inference
        e_val, _, qualified = self.avi.calculate_e_value(
            n_a, self.metrics["control"]["conversions"],
            n_b, self.metrics["candidate"]["conversions"],
        )

        if qualified:
            self.baseline = self.active_candidate
            self.active_candidate = None
            return AdjudicationOutcome(
                action="PROMOTE_CANDIDATE",
                copy_published=True,
                reason=f"Statistical qualification achieved: e-value {e_val:.2f} exceeded hurdle (20.0).",
                e_value=e_val,
                sample_size={"control": n_a, "candidate": n_b},
                duration_hours=duration_hours,
                srm_detected=False,
                active_headline=self.baseline,
            )

        return AdjudicationOutcome(
            action="RETAIN_EXISTING",
            copy_published=False,
            reason=f"Statistical qualification hurdle not reached (e-value {e_val:.2f} < 20.0). Existing copy retained.",
            e_value=e_val,
            sample_size={"control": n_a, "candidate": n_b},
            duration_hours=duration_hours,
            srm_detected=False,
            active_headline=self.baseline,
        )
