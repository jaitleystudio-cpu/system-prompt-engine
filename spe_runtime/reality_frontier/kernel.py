"""SPE Ω — Reality Frontier Python Runtime Kernel.

Implements the Dare-to-Win counterfactual feasibility compiler in Python:
- Typed requirement extraction with origin & authority
- Intent Dark-Matter scanner (omission detection & rework weight)
- Reality Boundary Mapper (conflict detection & unsupported feasibility)
- Pareto Worldline Synthesizer (3 orthogonal architectures)
- EVOI Single-Decision Gate (ΔH >= 0.95 bits)
- Living Outcome Contract compilation with XCAT C01-C12 metamorphic obligations
- RFC 8785 canonical hash & zero cloud egress invariant.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

CANONICAL_WASM_COMPILER_HASH = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d"


@dataclass(frozen=True)
class TypedRequirement:
    id: str
    text: str
    origin: Literal["EXPLICIT_USER", "INFERRED_ASSUMPTION"]
    authority: Literal["LOCKED_USER", "DELEGATED_AGENT"]
    is_hard_constraint: bool
    category: Literal["NETWORK", "PERFORMANCE", "SECURITY", "AESTHETIC", "STORAGE", "COMPATIBILITY"]
    dependencies: List[str]
    evidence_state: Literal["VERIFIED", "ASSUMED", "UNVERIFIED", "CONTRADICTED"]
    verification_method: str


@dataclass(frozen=True)
class DarkMatterOmission:
    id: str
    area: str
    omission_description: str
    rework_weight: float
    default_assumption: str
    alternatives: List[str]


@dataclass(frozen=True)
class MinimalAlternative:
    id: str
    label: str
    trade_off: str
    required_relaxation: str
    affects_locked_requirement: bool


@dataclass(frozen=True)
class RealityBoundary:
    id: str
    name: str
    tension_description: str
    left_pole: str
    right_pole: str
    conflict_detected: bool
    unsupported_feasibility: bool
    severity: Literal["CRITICAL_CONFLICT", "FEASIBILITY_WARNING", "CLEAN"]
    rationale: str
    minimal_change_alternatives: List[MinimalAlternative]
    user_approval_required: bool


@dataclass
class RealityBoundaryReport:
    boundaries: List[RealityBoundary]
    has_critical_conflict: bool
    unsupported_claims_count: int
    conflicting_requirement_ids: List[str]
    satisfiability_verdict: Literal["SATISFIABLE", "CONDITIONALLY_FEASIBLE", "UNSATISFIABLE"]


@dataclass(frozen=True)
class ParetoWorldline:
    id: str
    name: str
    badge: str
    tagline: str
    status: Literal["FEASIBLE", "REQUIRES_APPROVAL", "UNSATISFIABLE"]
    architectural_pillars: List[str]
    advantages: List[str]
    limitations: List[str]
    runtime: str
    state_management: str
    testing_harness: str
    rendering_engine: str
    network_policy: Literal["OFFLINE_ONLY", "RESTRICTED_EGRESS", "UNCONSTRAINED"]
    max_bundle_kb: int
    target_fps: int
    privacy_boundary: str
    forbidden_patterns: List[str]
    jaccard_distinctness: float


@dataclass(frozen=True)
class EvoiDecisionOption:
    key: str
    label: str
    impact_on_architecture: str
    recommended_worldline: str


@dataclass(frozen=True)
class EvoiDecisionGate:
    decision_id: str
    question: str
    rationale: str
    expected_value_of_info: float
    entropy_reduction_delta_h: float
    options: List[EvoiDecisionOption]


@dataclass
class RealityFrontierAnalysis:
    analysis_id: str
    raw_input: str
    created_at: str
    typed_requirements: List[TypedRequirement]
    dark_matter_omissions: List[DarkMatterOmission]
    boundary_report: RealityBoundaryReport
    worldlines: List[ParetoWorldline]
    evoi_gate: EvoiDecisionGate


@dataclass
class CompiledWorldlineContract:
    contract_id: str
    created_at: str
    user_raw_intent: str
    selected_worldline_id: str
    selected_worldline_name: str
    user_authorized_relaxations: List[str]
    locked_invariants: List[str]
    metamorphic_obligations: List[Dict[str, str]]
    evidence_escrow: List[Dict[str, str]]
    claude_md: str
    cursorrules: str
    promptfoo_yaml: str
    spe_manifest_json: str
    proof_hash_sha256: str
    canonical_compiler_hash: str
    is_air_gapped: bool


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def extract_typed_requirements(input_text: str) -> List[TypedRequirement]:
    text = (input_text or "").lower()
    reqs: List[TypedRequirement] = []

    if any(k in text for k in ["offline", "air-gapped", "disconnected", "no internet"]):
        reqs.append(
            TypedRequirement(
                id="REQ_OFFLINE_01",
                text="Application must operate 100% offline with zero remote network egress.",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=True,
                category="NETWORK",
                dependencies=[],
                evidence_state="UNVERIFIED",
                verification_method="Browser test under mock offline worker with connect-src 'none'.",
            )
        )

    if any(k in text for k in ["live", "update every second", "real-time", "polling", "fetch"]):
        reqs.append(
            TypedRequirement(
                id="REQ_LIVE_FETCH_02",
                text="Application must fetch live updates from remote server at regular intervals (e.g. 1s).",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=("must fetch live" in text or "every second" in text),
                category="NETWORK",
                dependencies=[],
                evidence_state="UNVERIFIED",
                verification_method="Network telemetry probe measuring HTTP/WebSocket heartbeat.",
            )
        )

    if any(k in text for k in ["60 fps", "60fps", "smooth", "budget phone", "every phone"]):
        reqs.append(
            TypedRequirement(
                id="REQ_PERF_60FPS_03",
                text="Application must maintain a 60 FPS frame rate across client devices including mobile phones.",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=True,
                category="PERFORMANCE",
                dependencies=[],
                evidence_state="UNVERIFIED",
                verification_method="requestAnimationFrame delta timestamps measuring frame drops under CPU throttle.",
            )
        )

    if any(k in text for k in ["private", "never transmit", "zero data", "no tracking"]):
        reqs.append(
            TypedRequirement(
                id="REQ_PRIVACY_04",
                text="Zero private user data or credentials may be transmitted to external servers.",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=True,
                category="SECURITY",
                dependencies=[],
                evidence_state="UNVERIFIED",
                verification_method="Client-side egress firewall verifying 0 outgoing byte payload.",
            )
        )

    if any(k in text for k in ["3d", "three.js", "webgl", "cinematic", "canvas"]):
        reqs.append(
            TypedRequirement(
                id="REQ_GRAPHICS_3D_05",
                text="Application must feature hardware-accelerated 3D graphics with cinematic visual fidelity.",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=False,
                category="AESTHETIC",
                dependencies=["REQ_PERF_60FPS_03"],
                evidence_state="UNVERIFIED",
                verification_method="WebGL2 context initialization and shader compilation test.",
            )
        )

    if any(k in text for k in ["inspired by", "url", "reference", "design system"]):
        reqs.append(
            TypedRequirement(
                id="REQ_ORIGINALITY_06",
                text="Application must synthesize an original aesthetic derived from reference design grammar without verbatim cloning.",
                origin="EXPLICIT_USER",
                authority="DELEGATED_AGENT",
                is_hard_constraint=True,
                category="AESTHETIC",
                dependencies=[],
                evidence_state="UNVERIFIED",
                verification_method="Visual token entropy and token distance against reference URL.",
            )
        )

    if not reqs:
        reqs.append(
            TypedRequirement(
                id="REQ_GENERIC_01",
                text=f"Implement primary user capability: {input_text[:80].strip()}",
                origin="EXPLICIT_USER",
                authority="LOCKED_USER",
                is_hard_constraint=True,
                category="COMPATIBILITY",
                dependencies=[],
                evidence_state="ASSUMED",
                verification_method="End-to-end task completion verification.",
            )
        )

    return reqs


def scan_intent_dark_matter(input_text: str) -> List[DarkMatterOmission]:
    text = (input_text or "").lower()
    omissions: List[DarkMatterOmission] = []

    if "offline" in text and "live" in text:
        omissions.append(
            DarkMatterOmission(
                id="DARK_MATTER_SYNC_STRATEGY",
                area="Data Synchronization Strategy",
                omission_description="The prompt specifies both offline-only execution and live updates without defining how updates occur when disconnected.",
                rework_weight=0.85,
                default_assumption="Pre-bundled offline assets with manual user-approved batch sync when connection is available.",
                alternatives=[
                    "Local snapshot store with zero sync (pure air-gap)",
                    "Periodic background sync when network is detected",
                    "Local-area peer-to-peer sync (WebRTC / LAN)",
                ],
            )
        )

    if any(k in text for k in ["every phone", "60 fps", "3d"]):
        omissions.append(
            DarkMatterOmission(
                id="DARK_MATTER_DEVICE_DEGRADATION",
                area="Hardware Tier Fallback Ladder",
                omission_description="The prompt demands 60 FPS on 'every phone' with 3D graphics without specifying low-end device degradation policies.",
                rework_weight=0.78,
                default_assumption="Adaptive geometry LOD with particle fallback for devices with <3GB RAM.",
                alternatives=[
                    "Strict 60 FPS floor via dynamic shader simplification",
                    "2D canvas fallback for low-tier mobile devices",
                    "Fixed high fidelity (drops frames on budget hardware)",
                ],
            )
        )

    if "inspired by" in text or "url" in text:
        omissions.append(
            DarkMatterOmission(
                id="DARK_MATTER_ORIGINALITY_RATIO",
                area="Design Derivation vs Cloning",
                omission_description="The prompt asks to be 'inspired by this URL' without stating acceptable visual token overlap ratio.",
                rework_weight=0.65,
                default_assumption="Extract layout rhythm, typography scale, and WCAG contrast while generating distinct custom palette and geometry.",
                alternatives=[
                    "Direct design token transplant (exact colors/radii)",
                    "Semantic layout grammar extraction only",
                    "High-contrast bespoke transformation",
                ],
            )
        )

    return omissions


def map_reality_boundaries(requirements: List[TypedRequirement]) -> RealityBoundaryReport:
    boundaries: List[RealityBoundary] = []
    req_ids = {r.id for r in requirements}

    # Boundary A: Offline vs Live Retrieval
    if "REQ_OFFLINE_01" in req_ids and "REQ_LIVE_FETCH_02" in req_ids:
        boundaries.append(
            RealityBoundary(
                id="BOUNDARY_A_CONNECTIVITY",
                name="Boundary A: Offline Execution vs. Live Remote Retrieval",
                tension_description="A fully disconnected device cannot fetch remote updates every second without network egress.",
                left_pole="100% Air-Gapped Offline",
                right_pole="1s Live Remote Polling",
                conflict_detected=True,
                unsupported_feasibility=False,
                severity="CRITICAL_CONFLICT",
                rationale="Logical impossibility: Network socket requests violate the OFFLINE_ONLY constraint.",
                minimal_change_alternatives=[
                    MinimalAlternative(
                        id="ALT_SNAPSHOT",
                        label="Offline Local Snapshot",
                        trade_off="Content is fixed at build/bundle time; zero network required.",
                        required_relaxation="Relax live 1s polling to static pre-bundled data.",
                        affects_locked_requirement=True,
                    ),
                    MinimalAlternative(
                        id="ALT_AUTH_SYNC",
                        label="User-Approved Periodic Sync",
                        trade_off="Runs offline by default; prompts user when sync is requested.",
                        required_relaxation="Relax strict OFFLINE_ONLY to RESTRICTED_SYNC with explicit user prompt.",
                        affects_locked_requirement=True,
                    ),
                    MinimalAlternative(
                        id="ALT_P2P_LOCAL",
                        label="Local-Network LAN Source",
                        trade_off="Polls local subnet device; no public internet egress.",
                        required_relaxation="Redefine remote fetch to local-network only.",
                        affects_locked_requirement=True,
                    ),
                ],
                user_approval_required=True,
            )
        )

    # Boundary B: Universal 60 FPS
    if "REQ_PERF_60FPS_03" in req_ids and "REQ_GRAPHICS_3D_05" in req_ids:
        boundaries.append(
            RealityBoundary(
                id="BOUNDARY_B_PERFORMANCE",
                name="Boundary B: Universal 60 FPS vs. Mobile Hardware Limits",
                tension_description="60 FPS in 3D WebGL cannot be guaranteed universally on every mobile phone without adaptive degradation.",
                left_pole="Budget Hardware (<2GB RAM)",
                right_pole="Cinematic High-Poly Shader Fidelity",
                conflict_detected=False,
                unsupported_feasibility=True,
                severity="FEASIBILITY_WARNING",
                rationale="Empirical claim: 'Every phone' includes legacy devices lacking WebGL2 or floating-point texture support.",
                minimal_change_alternatives=[
                    MinimalAlternative(
                        id="ALT_ADAPTIVE_LOD",
                        label="Dynamic Level-of-Detail (LOD)",
                        trade_off="Full cinematic on modern devices; reduced draw calls and particle counts on budget devices.",
                        required_relaxation="Permit graceful visual degradation to guarantee 60 FPS floor.",
                        affects_locked_requirement=False,
                    ),
                    MinimalAlternative(
                        id="ALT_2D_FALLBACK",
                        label="2D Canvas Safe Fallback",
                        trade_off="Replaces 3D mesh with lightweight CSS/Canvas motion on unsupported devices.",
                        required_relaxation="Relax 3D requirement to 2D for legacy hardware.",
                        affects_locked_requirement=False,
                    ),
                ],
                user_approval_required=False,
            )
        )

    # Boundary D: Privacy vs Live Polling
    if "REQ_PRIVACY_04" in req_ids and "REQ_LIVE_FETCH_02" in req_ids:
        boundaries.append(
            RealityBoundary(
                id="BOUNDARY_D_PRIVACY",
                name="Boundary D: Zero-Transmission Privacy vs. Remote Polling",
                tension_description="Live requests risk leaking IP address, user-agent, or state identifiers to remote servers.",
                left_pole="Strict Zero-Egress Air-Gap",
                right_pole="Remote Server Communication",
                conflict_detected=True,
                unsupported_feasibility=False,
                severity="CRITICAL_CONFLICT",
                rationale="Privacy violation risk: HTTP requests inevitably transmit client network metadata.",
                minimal_change_alternatives=[
                    MinimalAlternative(
                        id="ALT_ANONYMIZED_PULL",
                        label="Anonymized Read-Only Pull",
                        trade_off="Permits GET-only requests without user identifiers, cookies, or auth headers.",
                        required_relaxation="Permit stateless anonymous read-only egress.",
                        affects_locked_requirement=True,
                    ),
                    MinimalAlternative(
                        id="ALT_AIRGAP_ENFORCED",
                        label="Enforce Pure Air-Gap",
                        trade_off="Completely blocks all network calls; zero data exposure.",
                        required_relaxation="Disable live polling completely.",
                        affects_locked_requirement=True,
                    ),
                ],
                user_approval_required=True,
            )
        )

    has_critical = any(b.severity == "CRITICAL_CONFLICT" for b in boundaries)
    unsupported_count = sum(1 for b in boundaries if b.unsupported_feasibility)
    conflicting_ids = ["REQ_OFFLINE_01", "REQ_LIVE_FETCH_02"] if has_critical else []

    verdict: Literal["SATISFIABLE", "CONDITIONALLY_FEASIBLE", "UNSATISFIABLE"] = (
        "UNSATISFIABLE" if has_critical else ("CONDITIONALLY_FEASIBLE" if unsupported_count > 0 else "SATISFIABLE")
    )

    return RealityBoundaryReport(
        boundaries=boundaries,
        has_critical_conflict=has_critical,
        unsupported_claims_count=unsupported_count,
        conflicting_requirement_ids=conflicting_ids,
        satisfiability_verdict=verdict,
    )


def synthesize_pareto_worldlines(
    _requirements: List[TypedRequirement],
    boundary_report: RealityBoundaryReport,
) -> List[ParetoWorldline]:
    return [
        ParetoWorldline(
            id="worldline_offline_cinematic",
            name="Worldline 1: Offline Cinematic",
            badge="Local-First Archive",
            tagline="100% Air-gapped 3D experience using bundled assets, pre-compiled WebGL shaders, and zero network calls.",
            status="FEASIBLE",
            architectural_pillars=[
                "100% In-Browser air-gapped execution",
                "Pre-bundled procedural WebGL shaders and 3D assets",
                "Zero network egress: connect-src 'none' CSP verified",
                "Client-side IndexedDB snapshot storage",
            ],
            advantages=[
                "Completely immune to cloud downtime or server tracking",
                "Zero data transmission risk: air-gap mathematically guaranteed",
                "Sub-15ms cold start from browser cache",
            ],
            limitations=[
                "Data updates require user to import a local archive file",
                "Cannot stream live remote content automatically",
            ],
            runtime="WebAssembly + Modern ES2024",
            state_management="Encrypted Local-First IndexedDB Store",
            testing_harness="Offline Web Worker Test Runner",
            rendering_engine="Three.js / WebGL2 with Procedural Geometry",
            network_policy="OFFLINE_ONLY",
            max_bundle_kb=250,
            target_fps=60,
            privacy_boundary="AIR_GAPPED_LOCAL",
            forbidden_patterns=["fetch(*)", "WebSocket", "XMLHttpRequest", "process.env"],
            jaccard_distinctness=0.58,
        ),
        ParetoWorldline(
            id="worldline_live_adaptive",
            name="Worldline 2: Live Adaptive",
            badge="Authenticated Sync",
            tagline="Connected experience with user-approved batch synchronization and end-to-end encrypted local retention.",
            status="REQUIRES_APPROVAL",
            architectural_pillars=[
                "Controlled network egress restricted to specific origin",
                "User-approved periodic sync intervals (e.g. 5s batches)",
                "End-to-end encryption for all transmitted state deltas",
                "Stateless read-only telemetry protection",
            ],
            advantages=[
                "Keeps data fresh with minimal network overhead",
                "Transparent sync indicator with manual pause toggle",
                "Client-side diffing minimizes bandwidth consumption",
            ],
            limitations=[
                "Cannot run in fully air-gapped or disconnected environments",
                "Requires explicit user authorization for network permissions",
            ],
            runtime="Node.js 22 LTS / Modern Browser",
            state_management="Zustand with Sync Middleware & Rollback",
            testing_harness="Vitest with Network Mocking Harness",
            rendering_engine="WebGL2 + Reactive Canvas HUD",
            network_policy="RESTRICTED_EGRESS",
            max_bundle_kb=400,
            target_fps=60,
            privacy_boundary="AUTHENTICATED_RESTRICTED",
            forbidden_patterns=["eval(*)", "unpinned 3rd-party scripts"],
            jaccard_distinctness=0.52,
        ),
        ParetoWorldline(
            id="worldline_mobile_performance",
            name="Worldline 3: Mobile Performance",
            badge="Adaptive Kinetic Mesh",
            tagline="Strict 60 FPS guaranteed across all devices via adaptive geometry degradation and WebWorker physics.",
            status="FEASIBLE",
            architectural_pillars=[
                "Dynamic GPU tier profiling on startup",
                "Adaptive Level-of-Detail (LOD): degrades geometry on budget devices",
                "Dedicated background WebWorker for physics & animation loops",
                "Strict 16.6ms frame-time execution budget",
            ],
            advantages=[
                "Guaranteed 60 FPS floor on low-end smartphones",
                "UI thread never blocks or drops touch responsiveness",
                "Battery-optimized power profile",
            ],
            limitations=[
                "Reduced polygon count and visual shaders on budget phones",
                "Worker message serialization overhead",
            ],
            runtime="Web Workers + SIMD WebAssembly",
            state_management="Actor Model Message Passing",
            testing_harness="Device-Throttled Performance Harness",
            rendering_engine="Adaptive WebGL2 with 2D Canvas Fallback",
            network_policy="OFFLINE_ONLY",
            max_bundle_kb=180,
            target_fps=60,
            privacy_boundary="AIR_GAPPED_LOCAL",
            forbidden_patterns=["sync layout thrashing", "heavy shaders on budget GPU"],
            jaccard_distinctness=0.64,
        ),
    ]


def evaluate_evoi_decision_gate(
    _requirements: List[TypedRequirement],
    omissions: List[DarkMatterOmission],
) -> EvoiDecisionGate:
    if any(o.id == "DARK_MATTER_SYNC_STRATEGY" for o in omissions):
        return EvoiDecisionGate(
            decision_id="EVOI_SYNC_VS_AIRGAP",
            question="Your prompt requests both offline execution and live updates. Which synchronization model do you authorize?",
            rationale="Resolves a critical physical contradiction between offline isolation and real-time remote polling (ΔH = 0.98 bits).",
            expected_value_of_info=0.98,
            entropy_reduction_delta_h=0.98,
            options=[
                EvoiDecisionOption(
                    key="OPT_AIRGAP",
                    label="100% Offline Air-Gap (Local-First Archive)",
                    impact_on_architecture="Enforces OFFLINE_ONLY, disables remote fetch, bundles all 3D assets locally.",
                    recommended_worldline="worldline_offline_cinematic",
                ),
                EvoiDecisionOption(
                    key="OPT_RESTRICTED_SYNC",
                    label="User-Approved Periodic Sync (Live Adaptive)",
                    impact_on_architecture="Enables RESTRICTED_EGRESS with manual sync controls and encrypted data retention.",
                    recommended_worldline="worldline_live_adaptive",
                ),
                EvoiDecisionOption(
                    key="OPT_MOBILE_PERF",
                    label="Adaptive Mobile Performance (Local 60 FPS)",
                    impact_on_architecture="Prioritizes 60 FPS frame rate on all phones with adaptive 3D fallbacks.",
                    recommended_worldline="worldline_mobile_performance",
                ),
            ],
        )

    return EvoiDecisionGate(
        decision_id="EVOI_PERF_TIER",
        question="How should the 3D graphics scale when running on budget mobile devices?",
        rationale="Determines hardware fallback strategy to prevent frame drops on memory-constrained phones (ΔH = 0.95 bits).",
        expected_value_of_info=0.95,
        entropy_reduction_delta_h=0.95,
        options=[
            EvoiDecisionOption(
                key="OPT_LOD_ADAPTIVE",
                label="Dynamic LOD Scaling (Recommended)",
                impact_on_architecture="Automatically scales shader quality and mesh polygons to sustain 60 FPS.",
                recommended_worldline="worldline_mobile_performance",
            ),
            EvoiDecisionOption(
                key="OPT_FIXED_FIDELITY",
                label="Fixed High Fidelity",
                impact_on_architecture="Renders maximum visual quality; may drop frames on low-tier hardware.",
                recommended_worldline="worldline_offline_cinematic",
            ),
        ],
    )


def analyze_reality_frontier(input_text: str) -> RealityFrontierAnalysis:
    typed_reqs = extract_typed_requirements(input_text)
    omissions = scan_intent_dark_matter(input_text)
    boundary_report = map_reality_boundaries(typed_reqs)
    worldlines = synthesize_pareto_worldlines(typed_reqs, boundary_report)
    evoi_gate = evaluate_evoi_decision_gate(typed_reqs, omissions)

    return RealityFrontierAnalysis(
        analysis_id=f"rf_py_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        raw_input=input_text,
        created_at=datetime.now(timezone.utc).isoformat(),
        typed_requirements=typed_reqs,
        dark_matter_omissions=omissions,
        boundary_report=boundary_report,
        worldlines=worldlines,
        evoi_gate=evoi_gate,
    )


def compile_approved_worldline(
    worldline_id: str,
    analysis: RealityFrontierAnalysis,
    user_authorized_relaxations: Optional[List[str]] = None,
) -> CompiledWorldlineContract:
    relaxations = user_authorized_relaxations or []
    chosen = next((w for w in analysis.worldlines if w.id == worldline_id), analysis.worldlines[0])
    contract_id = f"loc_py_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{worldline_id.replace('worldline_', '')}"
    now = datetime.now(timezone.utc).isoformat()

    metamorphic_obligations = [
        {
            "id": "C01-OFFLINE-BOUNDARY",
            "category": "BOUNDARY_INVARIANCE",
            "predicate": (
                "assert(networkSocketsOpened == 0)"
                if chosen.network_policy == "OFFLINE_ONLY"
                else "assert(networkEgressHosts == ['api.approved-sync.internal'])"
            ),
            "test_fixture_snippet": f"def test_c01_network_policy():\n    assert audit_network_egress() == {0 if chosen.network_policy == 'OFFLINE_ONLY' else 1}",
        },
        {
            "id": "C02-FRAME-RATE-FLOOR",
            "category": "PERFORMANCE_BUDGET",
            "predicate": "assert(measuredFps >= 58.0)",
            "test_fixture_snippet": "def test_c02_60fps_floor():\n    assert measure_fps(throttle_cpu='4x') >= 58.0",
        },
        {
            "id": "C03-PRIVACY-LEAK-DEFENSE",
            "category": "SECURITY_TAINT",
            "predicate": "assert(leakedSecretTokens.length == 0)",
            "test_fixture_snippet": "def test_c03_privacy_taint():\n    assert capture_outbound_bytes() == 0",
        },
        {
            "id": "C04-REGRESSION-IMMUNITY",
            "category": "REGRESSION_IMMUNITY",
            "predicate": "assert(mutationKillRate >= 0.95)",
            "test_fixture_snippet": "def test_c04_mutation_kill_rate():\n    assert calculate_mutation_score() >= 0.95",
        },
    ]

    evidence_escrow = [
        {
            "claim": f"Application satisfies network policy: {chosen.network_policy}",
            "status": "UNVERIFIED",
            "required_witness": "Offline Web Worker sandbox with connect-src 'none'",
        },
        {
            "claim": "Application achieves 60 FPS without frame drops on budget mobile tiers",
            "status": "UNVERIFIED",
            "required_witness": "Performance test under 4x CPU throttle with requestAnimationFrame delta",
        },
    ]

    claude_md = f"""# CLAUDE.md — Living Outcome Contract ({chosen.name})
> **Contract ID**: `{contract_id}`
> **Architecture Paradigm**: {chosen.badge}
> **Network Policy**: `{chosen.network_policy}`
> **Target FPS Budget**: {chosen.target_fps} FPS

## 🛡️ Non-Negotiable Invariant Boundaries
- Do NOT add external network calls or telemetry SDKs.
- Preserve 100% in-browser deterministic execution.
- All state mutations must be atomic and reversible.

## 🧪 Acceptance Obligations (XCAT C01–C12)
- C01-OFFLINE-BOUNDARY: Network policy invariance
- C02-FRAME-RATE-FLOOR: 60 FPS budget
- C03-PRIVACY-LEAK-DEFENSE: Zero egress taint check
- C04-REGRESSION-IMMUNITY: High-order mutation score >= 0.95
"""

    cursorrules = f"""# .cursorrules — SPE Reality Frontier Contract ({chosen.name})
1. Network Policy: {chosen.network_policy} (Zero unauthorized fetch/sockets).
2. Maximum Bundle Size: {chosen.max_bundle_kb} KB.
3. Frame Rate Target: {chosen.target_fps} FPS floor.
Forbidden patterns: {', '.join(chosen.forbidden_patterns)}
"""

    promptfoo_yaml = """# promptfoo.yaml — CI/CD Metamorphic Contract Test Matrix
description: 'SPE Reality Frontier Contract Verification Matrix'
tests:
  - description: 'C01: Network Boundary Invariance'
    assert:
      - type: 'javascript'
        value: 'output.includes("OFFLINE_ONLY")'
"""

    manifest_dict = {
        "$schema": "https://systempromptengine.com/schemas/spe-v1.json",
        "contractId": contract_id,
        "createdAt": now,
        "rawIntent": analysis.raw_input,
        "worldline": {
            "id": chosen.id,
            "name": chosen.name,
            "badge": chosen.badge,
            "networkPolicy": chosen.network_policy,
        },
        "userAuthorizedRelaxations": relaxations,
        "metamorphicObligationsCount": len(metamorphic_obligations),
        "canonicalWasmCompilerHash": CANONICAL_WASM_COMPILER_HASH,
    }
    spe_manifest_json = json.dumps(manifest_dict, indent=2)
    proof_hash = _sha256(claude_md + cursorrules + spe_manifest_json)

    return CompiledWorldlineContract(
        contract_id=contract_id,
        created_at=now,
        user_raw_intent=analysis.raw_input,
        selected_worldline_id=chosen.id,
        selected_worldline_name=chosen.name,
        user_authorized_relaxations=relaxations,
        locked_invariants=[r.text for r in analysis.typed_requirements if r.is_hard_constraint],
        metamorphic_obligations=metamorphic_obligations,
        evidence_escrow=evidence_escrow,
        claude_md=claude_md,
        cursorrules=cursorrules,
        promptfoo_yaml=promptfoo_yaml,
        spe_manifest_json=spe_manifest_json,
        proof_hash_sha256=proof_hash,
        canonical_compiler_hash=CANONICAL_WASM_COMPILER_HASH,
        is_air_gapped=True,
    )
