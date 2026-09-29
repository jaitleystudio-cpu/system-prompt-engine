"""Compile a VisualInputEnvelope into the Lane E output boundary."""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from spe_runtime.visual.compare import compare_observations
from spe_runtime.visual.constants import (
    DISPOSITION_ABSTAIN,
    DISPOSITION_READY,
    REASON_AUTHORITY,
    REASON_COMPARE_ARITY,
    REASON_COMPILED,
    REASON_GATING_FAIL,
    REASON_GATING_UNKNOWN,
    REASON_MALFORMED,
    REASON_NO_MEDIA,
    REASON_NO_OPAQUE,
    REASON_UNKNOWN_BLOCKS,
    REQUIRED_TAINT,
    SCHEMA_VERSION,
)
from spe_runtime.visual.envelope import VisualInputEnvelope, envelope_from_mapping
from spe_runtime.visual.errors import VisualInputError
from spe_runtime.visual.graph import build_evidence_graph
from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    ImageComparison,
    VisualEvidenceEdge,
    VisualEvidenceGraph,
    VisualEvidenceNode,
    VisualIntentContract,
    VisualObservation,
    VisualProvenance,
    VisualUncertainty,
    ownership_record,
)
from spe_runtime.visual.observe import observe_asset
from spe_runtime.visual.ocr import text_looks_like_instruction
from spe_runtime.visual.prompt import build_prompt


def _sha(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _standard_uncertainties() -> tuple[VisualUncertainty, ...]:
    return (
        VisualUncertainty(
            code="JUDGMENTS_REMAIN_UNKNOWN",
            statement=(
                "Style, object class, typography density, semantic layout, OCR truth, "
                "and scene equivalence are UNKNOWN. UNKNOWN is not PASS."
            ),
            severity="ADVISORY",
            blocks_pass=False,
        ),
        VisualUncertainty(
            code="MEDIA_IS_UNTRUSTED",
            statement="Pixel and OCR payloads are UNTRUSTED_SOURCE and MEDIA_OBSERVATION.",
            severity="ADVISORY",
            blocks_pass=False,
        ),
        VisualUncertainty(
            code="AUTHORITY_DELTA_ZERO",
            statement="authority_delta from media is 0.",
            severity="ADVISORY",
            blocks_pass=False,
        ),
        VisualUncertainty(
            code="DOWNSTREAM_OWNED_ELSEWHERE",
            statement=(
                "ProtectedIntent, Requirement Graph, XCAT, and K3 stay with Lane A. "
                "This contract does not own Quality, Massive Intent, Scholarly, or Search SEO."
            ),
            severity="ADVISORY",
            blocks_pass=False,
        ),
    )


def _contract_provenance(
    provenance_id: str,
    asset_ids: tuple[str, ...],
    digest: str,
) -> VisualProvenance:
    return VisualProvenance(
        provenance_id=provenance_id,
        source_asset_ids=asset_ids,
        method="visual-intent-contract/v1",
        epistemic_status=EpistemicStatus.OBSERVATION,
        taint_labels=REQUIRED_TAINT,
        content_digest=digest,
        authority_delta=0,
        note="Lane E output boundary. authority_delta=0. UNKNOWN is not PASS.",
    )


def _terminal_graph(
    *,
    graph_id: str,
    provenance_id: str,
    primary_claim: str,
    primary_value: str,
    primary_verdict: ClaimVerdict,
    authority_rejected: bool,
) -> VisualEvidenceGraph:
    nodes = [
        VisualEvidenceNode(
            node_id="n:contract:media",
            claim="media_present",
            value="0",
            verdict=ClaimVerdict.UNKNOWN,
            epistemic_status=EpistemicStatus.ABSENT,
            confidence=0.0,
            method="envelope",
            asset_ids=(),
            gates_contract=True,
            provenance_id=provenance_id,
        ),
        VisualEvidenceNode(
            node_id="n:contract:authority",
            claim="authority_delta",
            value="rejected" if authority_rejected else "0",
            verdict=ClaimVerdict.FAIL if authority_rejected else ClaimVerdict.PASS,
            epistemic_status=EpistemicStatus.OBSERVATION,
            confidence=1.0,
            method="lane-e-fence",
            asset_ids=(),
            gates_contract=True,
            provenance_id=provenance_id,
        ),
        VisualEvidenceNode(
            node_id="n:contract:taint",
            claim="untrusted_taint",
            value="UNTRUSTED_SOURCE,MEDIA_OBSERVATION",
            verdict=ClaimVerdict.PASS,
            epistemic_status=EpistemicStatus.OBSERVATION,
            confidence=1.0,
            method="lane-e-fence",
            asset_ids=(),
            gates_contract=True,
            provenance_id=provenance_id,
        ),
        VisualEvidenceNode(
            node_id="n:contract:boundary",
            claim="output_boundary",
            value="VisualIntentContract",
            verdict=ClaimVerdict.PASS,
            epistemic_status=EpistemicStatus.OBSERVATION,
            confidence=1.0,
            method="lane-e-fence",
            asset_ids=(),
            gates_contract=True,
            provenance_id=provenance_id,
        ),
        VisualEvidenceNode(
            node_id="n:contract:ingress",
            claim=primary_claim,
            value=primary_value,
            verdict=primary_verdict,
            epistemic_status=(
                EpistemicStatus.OBSERVATION
                if primary_verdict is not ClaimVerdict.UNKNOWN
                else EpistemicStatus.ABSENT
            ),
            confidence=1.0 if primary_verdict is ClaimVerdict.FAIL else 0.0,
            method="lane-e-fence",
            asset_ids=(),
            gates_contract=True,
            provenance_id=provenance_id,
        ),
    ]
    edges = (
        VisualEvidenceEdge(
            edge_id="e:0:informs",
            source_id="n:contract:ingress",
            target_id="n:contract:boundary",
            relation="informs",
        ),
    )
    return VisualEvidenceGraph(graph_id=graph_id, nodes=tuple(nodes), edges=edges)


def _finish(
    *,
    contract_id: str,
    envelope_id: str,
    mode: str,
    observations: tuple[VisualObservation, ...],
    comparisons: tuple[ImageComparison, ...],
    graph: VisualEvidenceGraph,
    uncertainties: tuple[VisualUncertainty, ...],
    provenance: tuple[VisualProvenance, ...],
    user_goal: str,
    declared_at: str,
    extra_reasons: tuple[str, ...] = (),
) -> VisualIntentContract:
    verdict = graph.gating_verdict()
    reasons = list(extra_reasons)
    if any(item.blocks_pass for item in uncertainties) and verdict is ClaimVerdict.PASS:
        verdict = ClaimVerdict.UNKNOWN
        reasons.append(REASON_UNKNOWN_BLOCKS)
    if verdict is ClaimVerdict.PASS:
        reasons.append(REASON_COMPILED)
    elif verdict is ClaimVerdict.FAIL and REASON_GATING_FAIL not in reasons:
        reasons.append(REASON_GATING_FAIL)
    elif verdict is ClaimVerdict.UNKNOWN and not reasons:
        reasons.append(REASON_GATING_UNKNOWN)
    # Preserve order while dropping duplicates.
    deduped: list[str] = []
    for reason in reasons:
        if reason not in deduped:
            deduped.append(reason)
    disposition = DISPOSITION_READY if verdict is ClaimVerdict.PASS else DISPOSITION_ABSTAIN
    statements = tuple(f"{item.code}: {item.statement}" for item in uncertainties)
    prompt_block, slots = build_prompt(
        observations=observations,
        comparisons=comparisons,
        user_goal=user_goal,
        declared_at=declared_at,
        uncertainties=statements,
    )
    return VisualIntentContract(
        contract_id=contract_id,
        schema_version=SCHEMA_VERSION,
        source_envelope_id=envelope_id,
        mode=mode,
        observations=observations,
        evidence_graph=graph,
        uncertainties=uncertainties,
        provenance=provenance,
        comparisons=comparisons,
        verdict=verdict,
        verdict_reason_codes=tuple(deduped),
        authority_delta=0,
        disposition=disposition,
        prompt_block=prompt_block,
        prompt_slots=slots,
        ownership=ownership_record(),
    )


def _ids(envelope: VisualInputEnvelope, authority_rejected: bool) -> tuple[str, str]:
    digests = [asset.raster.digest for asset in envelope.assets]
    ocr = "|".join(f"{item.asset_id}:{item.text}" for item in envelope.supplied_ocr)
    material = "|".join(
        [
            envelope.envelope_id,
            envelope.mode.value,
            ",".join(digests),
            envelope.user_goal,
            envelope.declared_at,
            ocr,
            "authority_rejected" if authority_rejected else "authority_ok",
            ",".join(envelope.rejected_ownership_keys),
        ]
    )
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:20]
    return f"vic_{digest}", f"sha256:{hashlib.sha256(material.encode('utf-8')).hexdigest()}"


def compile_visual_intent(
    envelope: VisualInputEnvelope,
    *,
    authority_delta: int = 0,
) -> VisualIntentContract:
    """Compile media into a VisualIntentContract. Non-zero authority fails closed."""

    if not isinstance(envelope, VisualInputEnvelope):
        raise VisualInputError("compile_visual_intent requires a VisualInputEnvelope")
    authority_rejected = int(authority_delta) != 0
    contract_id, contract_digest = _ids(envelope, authority_rejected)
    observations: list[VisualObservation] = []
    uncertainties: list[VisualUncertainty] = list(_standard_uncertainties())
    known_ids = {asset.asset_id for asset in envelope.assets}
    if not envelope.assets:
        uncertainties.append(
            VisualUncertainty(
                code=REASON_NO_MEDIA,
                statement="No raster assets were supplied.",
                severity="BLOCKING",
                blocks_pass=True,
            )
        )
    if envelope.mode.value == "compare" and len(envelope.assets) < 2:
        uncertainties.append(
            VisualUncertainty(
                code=REASON_COMPARE_ARITY,
                statement="Compare mode requires two assets. Missing media is not a match.",
                severity="BLOCKING",
                blocks_pass=True,
            )
        )
    if authority_rejected:
        uncertainties.append(
            VisualUncertainty(
                code=REASON_AUTHORITY,
                statement="A non-zero authority_delta was rejected. Media cannot mint authority.",
                severity="BLOCKING",
                blocks_pass=True,
            )
        )
    if envelope.rejected_ownership_keys:
        uncertainties.append(
            VisualUncertainty(
                code="OWNERSHIP_FIELD_REJECTED",
                statement=(
                    "Payload fields owned by other lanes were ignored: "
                    + ", ".join(envelope.rejected_ownership_keys)
                ),
                severity="BLOCKING",
                blocks_pass=True,
                related_claim_ids=("n:contract:ownership",),
            )
        )
    if text_looks_like_instruction(envelope.user_goal):
        uncertainties.append(
            VisualUncertainty(
                code="MEDIA_TEXT_NOT_INSTRUCTIONS",
                statement=(
                    "user_goal contains instruction-like wording and is stored as data only."
                ),
                severity="ADVISORY",
                blocks_pass=False,
            )
        )
    orphans = [item for item in envelope.supplied_ocr if item.asset_id not in known_ids]
    for item in orphans:
        snippet = item.text.replace("\n", " ")[:180]
        uncertainties.append(
            VisualUncertainty(
                code="ORPHAN_SUPPLIED_OCR",
                statement=f"Supplied OCR for unknown asset {item.asset_id!r} was not attached: {snippet}",
                severity="ADVISORY",
                blocks_pass=False,
            )
        )
    for asset in envelope.assets:
        attached = tuple(item for item in envelope.supplied_ocr if item.asset_id == asset.asset_id)
        observation, notes = observe_asset(asset, attached)
        observations.append(observation)
        uncertainties.extend(notes)
    observation_tuple = tuple(observations)
    comparisons = compare_observations(observation_tuple) if len(observation_tuple) >= 2 else ()
    asset_ids = tuple(asset.asset_id for asset in envelope.assets)
    provenance_id = "prov:contract:" + contract_id
    content_digest = contract_digest
    if asset_ids:
        content_digest = _sha(
            "|".join(item.provenance.content_digest for item in observation_tuple).encode("utf-8")
        )
    contract_provenance = _contract_provenance(provenance_id, asset_ids, content_digest)
    graph = build_evidence_graph(
        graph_id="graph:" + contract_id,
        observations=observation_tuple,
        comparisons=comparisons,
        asset_count=len(envelope.assets),
        mode=envelope.mode.value,
        authority_rejected=authority_rejected,
        ownership_keys=envelope.rejected_ownership_keys,
        contract_provenance_id=provenance_id,
    )
    extra: list[str] = []
    if authority_rejected:
        extra.append(REASON_AUTHORITY)
    if envelope.rejected_ownership_keys:
        extra.append("OWNERSHIP_FIELD_REJECTED")
    if not envelope.assets:
        extra.append(REASON_NO_MEDIA)
    if envelope.mode.value == "compare" and len(envelope.assets) < 2:
        extra.append(REASON_COMPARE_ARITY)
    if any(item.opaque_samples <= 0 for item in observation_tuple):
        extra.append(REASON_NO_OPAQUE)
    asset_provenance = tuple(item.provenance for item in observation_tuple)
    return _finish(
        contract_id=contract_id,
        envelope_id=envelope.envelope_id,
        mode=envelope.mode.value,
        observations=observation_tuple,
        comparisons=comparisons,
        graph=graph,
        uncertainties=tuple(uncertainties),
        provenance=asset_provenance + (contract_provenance,),
        user_goal=envelope.user_goal,
        declared_at=envelope.declared_at,
        extra_reasons=tuple(extra),
    )


def _mode_of(payload: Mapping[str, Any]) -> str:
    mode = payload.get("mode")
    if mode in {"image_to_prompt", "compare", "describe"}:
        return str(mode)
    return "unspecified"


def _authority_rejected(payload: Mapping[str, Any]) -> bool:
    raw = payload.get("authority_delta", payload.get("authorityDelta", 0))
    try:
        return int(raw) != 0
    except (TypeError, ValueError):
        return True


def compile_visual_intent_from_mapping(payload: Mapping[str, Any]) -> VisualIntentContract:
    """Untrusted mapping ingress. Malformed input returns a closed contract."""

    if not isinstance(payload, Mapping):
        raise VisualInputError("visual payload must be a mapping")
    authority_rejected = _authority_rejected(payload)
    try:
        envelope = envelope_from_mapping(payload)
    except (VisualInputError, ValueError, KeyError, TypeError) as exc:
        return _malformed_contract(payload, exc, authority_rejected=authority_rejected)
    return compile_visual_intent(envelope, authority_delta=1 if authority_rejected else 0)


def _malformed_contract(
    payload: Mapping[str, Any],
    exc: Exception,
    *,
    authority_rejected: bool,
) -> VisualIntentContract:
    message = str(exc)[:300]
    envelope_id = payload.get("envelope_id")
    if not isinstance(envelope_id, str) or not envelope_id.strip():
        envelope_id = "malformed"
    budget = "ANALYSIS_SIDE_EXCEEDED" in message or "ANALYSIS_PIXELS_EXCEEDED" in message
    reasons = [REASON_MALFORMED]
    primary_verdict = ClaimVerdict.UNKNOWN
    primary_claim = "ingress"
    if budget:
        reasons = ["ANALYSIS_BUDGET_EXCEEDED"]
        primary_verdict = ClaimVerdict.FAIL
        primary_claim = "analysis_budget"
    if authority_rejected:
        reasons.append(REASON_AUTHORITY)
        primary_verdict = ClaimVerdict.FAIL
    material = f"{envelope_id}|{message}|{authority_rejected}".encode("utf-8")
    digest = hashlib.sha256(material).hexdigest()
    contract_id = "vic_" + digest[:20]
    provenance_id = "prov:contract:" + contract_id
    provenance = _contract_provenance(provenance_id, (), _sha(material))
    graph = _terminal_graph(
        graph_id="graph:" + contract_id,
        provenance_id=provenance_id,
        primary_claim=primary_claim,
        primary_value=message or REASON_MALFORMED,
        primary_verdict=primary_verdict,
        authority_rejected=authority_rejected,
    )
    uncertainties = list(_standard_uncertainties())
    uncertainties.append(
        VisualUncertainty(
            code=reasons[0],
            statement=message or "Visual input was malformed.",
            severity="BLOCKING",
            blocks_pass=True,
        )
    )
    if authority_rejected:
        uncertainties.append(
            VisualUncertainty(
                code=REASON_AUTHORITY,
                statement="A non-zero authority_delta was rejected. Media cannot mint authority.",
                severity="BLOCKING",
                blocks_pass=True,
            )
        )
    return _finish(
        contract_id=contract_id,
        envelope_id=envelope_id,
        mode=_mode_of(payload),
        observations=(),
        comparisons=(),
        graph=graph,
        uncertainties=tuple(uncertainties),
        provenance=(provenance,),
        user_goal="",
        declared_at="",
        extra_reasons=tuple(reasons),
    )
