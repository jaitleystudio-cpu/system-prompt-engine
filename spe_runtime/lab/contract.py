"""Autonomous Daily 3D Lab pipeline boundary.

Contract ``spe.daily-lab-pipeline.v1``:

    discovery → generate → verify → publish

This foundation records states and refusals for a local, finite lab.
It does not host, deploy, open a network connection, or publish.

Verification UNKNOWN is not PASS. Publish authorization has a single
state, NOT_AUTHORIZED. ``hold_publish`` requires an ``ExternalHumanApproval``.
That approval type can only represent ``NOT_GRANTED``. This module does
not construct or accept a granted decision.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from enum import Enum
from typing import Literal

PIPELINE_CONTRACT_ID = "spe.daily-lab-pipeline.v1"
FINITE_DAILY_QUEUE_BOUND = 14

_CANDIDATE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_FORBIDDEN_SCOPES = frozenset(
    {
        "adaptive cognitive evolution",
        "meta brain",
        "champion challenger",
        "success genome",
    }
)
_BLOCKED_PHASE_NAMES = frozenset(
    {"PUBLISHED", "AUTHORIZED", "LIVE", "DEPLOYED", "HOSTED"}
)


class NetworkMode(str, Enum):
    """The only mode this foundation will adopt."""

    NONE = "NONE"


class DiscoverySource(str, Enum):
    LOCAL_FINITE_QUEUE = "LOCAL_FINITE_QUEUE"


class Stage(str, Enum):
    DISCOVERY = "DISCOVERY"
    GENERATE = "GENERATE"
    VERIFY = "VERIFY"
    PUBLISH = "PUBLISH"


class PipelinePhase(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    DISCOVERY = "DISCOVERY"
    GENERATE = "GENERATE"
    VERIFY = "VERIFY"
    PUBLISH_HELD = "PUBLISH_HELD"
    REFUSED = "REFUSED"


class VerificationVerdict(str, Enum):
    NOT_RUN = "NOT_RUN"
    UNKNOWN = "UNKNOWN"
    FAIL = "FAIL"
    PASS = "PASS"


class PublishAuthorization(str, Enum):
    """No granted member exists. A later gate must add one outside this module."""

    NOT_AUTHORIZED = "NOT_AUTHORIZED"


class PublishStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    HELD = "HELD"
    REFUSED = "REFUSED"


class RefusalCode(str, Enum):
    NETWORK_REFUSED = "NETWORK_REFUSED"
    HOSTING_REFUSED = "HOSTING_REFUSED"
    DEPLOYMENT_REFUSED = "DEPLOYMENT_REFUSED"
    AUTOMATIC_PUBLISH_REFUSED = "AUTOMATIC_PUBLISH_REFUSED"
    LIVE_PUBLISH_REFUSED = "LIVE_PUBLISH_REFUSED"
    VERIFICATION_UNKNOWN_NOT_PASS = "VERIFICATION_UNKNOWN_NOT_PASS"
    VERIFICATION_NOT_PASS = "VERIFICATION_NOT_PASS"
    PUBLISH_NOT_AUTHORIZED = "PUBLISH_NOT_AUTHORIZED"
    HUMAN_GATE_NOT_GRANTED = "HUMAN_GATE_NOT_GRANTED"
    ILLEGAL_TRANSITION = "ILLEGAL_TRANSITION"
    FORBIDDEN_SCOPE = "FORBIDDEN_SCOPE"
    EMPTY_DISCOVERY = "EMPTY_DISCOVERY"
    UNBOUNDED_DISCOVERY = "UNBOUNDED_DISCOVERY"
    DUPLICATE_CANDIDATE = "DUPLICATE_CANDIDATE"
    REMOTE_DISCOVERY_REFUSED = "REMOTE_DISCOVERY_REFUSED"
    SPECIMEN_NOT_IN_DISCOVERY = "SPECIMEN_NOT_IN_DISCOVERY"
    STAGE_SKIP_REFUSED = "STAGE_SKIP_REFUSED"


_NEXT: dict[PipelinePhase, frozenset[PipelinePhase]] = {
    PipelinePhase.NOT_STARTED: frozenset(
        {PipelinePhase.DISCOVERY, PipelinePhase.REFUSED}
    ),
    PipelinePhase.DISCOVERY: frozenset(
        {PipelinePhase.GENERATE, PipelinePhase.REFUSED}
    ),
    PipelinePhase.GENERATE: frozenset({PipelinePhase.VERIFY, PipelinePhase.REFUSED}),
    PipelinePhase.VERIFY: frozenset(
        {PipelinePhase.PUBLISH_HELD, PipelinePhase.REFUSED}
    ),
    PipelinePhase.PUBLISH_HELD: frozenset({PipelinePhase.PUBLISH_HELD}),
    PipelinePhase.REFUSED: frozenset({PipelinePhase.REFUSED}),
}


def verification_counts_as_pass(verdict: VerificationVerdict) -> bool:
    """UNKNOWN, FAIL, and NOT_RUN are not PASS."""

    return verdict is VerificationVerdict.PASS


def propose_phase(
    current: PipelinePhase, proposed: str
) -> tuple[bool, PipelinePhase | None, RefusalCode | None]:
    """Advance one step. There is no PUBLISHED phase to enter."""

    if proposed in _BLOCKED_PHASE_NAMES:
        return False, None, RefusalCode.LIVE_PUBLISH_REFUSED
    try:
        target = PipelinePhase(proposed)
    except ValueError:
        return False, None, RefusalCode.ILLEGAL_TRANSITION
    if target not in _NEXT[current]:
        code = (
            RefusalCode.STAGE_SKIP_REFUSED
            if target is not PipelinePhase.REFUSED
            else RefusalCode.ILLEGAL_TRANSITION
        )
        return False, None, code
    return True, target, None


def _normalize_scope(value: str) -> str:
    folded = value.casefold().replace("_", " ").replace("-", " ").replace("/", " ")
    return " ".join(folded.split())


def _refusal(code: RefusalCode, stage: Stage, detail: str) -> PipelineRefusal:
    return PipelineRefusal(code=code, stage=stage, detail=detail)


@dataclass(frozen=True)
class ExternalHumanApproval:
    """Required publish input. This foundation cannot mark it granted.

    ``decision`` is fixed to NOT_GRANTED. A later human gate has to be a
    different type, outside this module. Passing any other decision fails.
    """

    gate_id: str
    approver_ref: str
    decision: Literal["NOT_GRANTED"] = "NOT_GRANTED"

    def __post_init__(self) -> None:
        if self.decision != "NOT_GRANTED":
            raise ValueError(RefusalCode.HUMAN_GATE_NOT_GRANTED.value)
        if not str(self.gate_id).strip() or not str(self.approver_ref).strip():
            raise ValueError(RefusalCode.HUMAN_GATE_NOT_GRANTED.value)


@dataclass(frozen=True)
class PipelineRefusal:
    code: RefusalCode
    stage: Stage
    detail: str

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code.value, "stage": self.stage.value, "detail": self.detail}


@dataclass(frozen=True)
class DiscoveryRecord:
    source: DiscoverySource
    network_mode: NetworkMode
    candidate_ids: tuple[str, ...]
    status: Literal["COMPLETE", "REFUSED"]

    def to_dict(self) -> dict[str, object]:
        return {
            "source": self.source.value,
            "network_mode": self.network_mode.value,
            "candidate_ids": list(self.candidate_ids),
            "status": self.status,
        }


@dataclass(frozen=True)
class GenerateRecord:
    draft_id: str
    specimen_id: str
    artifact_kind: Literal["LOCAL_DRAFT"]
    network_mode: NetworkMode
    hosted: Literal[False]
    deployed: Literal[False]
    status: Literal["COMPLETE"]

    def __post_init__(self) -> None:
        if self.artifact_kind != "LOCAL_DRAFT":
            raise ValueError(RefusalCode.ILLEGAL_TRANSITION.value)
        if self.hosted is not False or self.deployed is not False:
            raise ValueError(RefusalCode.DEPLOYMENT_REFUSED.value)
        if self.network_mode is not NetworkMode.NONE:
            raise ValueError(RefusalCode.NETWORK_REFUSED.value)

    def to_dict(self) -> dict[str, object]:
        return {
            "draft_id": self.draft_id,
            "specimen_id": self.specimen_id,
            "artifact_kind": self.artifact_kind,
            "network_mode": self.network_mode.value,
            "hosted": False,
            "deployed": False,
            "status": self.status,
        }


@dataclass(frozen=True)
class VerifyRecord:
    draft_id: str
    verdict: VerificationVerdict
    counts_as_pass: bool
    status: Literal["COMPLETE", "REFUSED"]

    def __post_init__(self) -> None:
        expected = verification_counts_as_pass(self.verdict)
        if self.counts_as_pass is not expected:
            raise ValueError(RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS.value)
        if self.verdict is VerificationVerdict.UNKNOWN and self.counts_as_pass:
            raise ValueError(RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS.value)

    def to_dict(self) -> dict[str, object]:
        return {
            "draft_id": self.draft_id,
            "verdict": self.verdict.value,
            "counts_as_pass": self.counts_as_pass,
            "status": self.status,
        }


@dataclass(frozen=True)
class PublishRecord:
    """A publish receipt this foundation is allowed to form.

    Authorization, live, hosted, deployed, and foundation grant are fixed.
    Runtime checks reject any attempt to set them otherwise.
    """

    draft_id: str | None
    authorization: PublishAuthorization = PublishAuthorization.NOT_AUTHORIZED
    published: bool = False
    live: bool = False
    automatic: bool = False
    hosted: bool = False
    deployed: bool = False
    network_mode: NetworkMode = NetworkMode.NONE
    status: PublishStatus = PublishStatus.NOT_STARTED
    external_approval_required: bool = True
    external_approval_granted_by_foundation: bool = False

    def __post_init__(self) -> None:
        if self.authorization is not PublishAuthorization.NOT_AUTHORIZED:
            raise ValueError(RefusalCode.PUBLISH_NOT_AUTHORIZED.value)
        if self.published is not False:
            raise ValueError(RefusalCode.LIVE_PUBLISH_REFUSED.value)
        if self.live is not False:
            raise ValueError(RefusalCode.LIVE_PUBLISH_REFUSED.value)
        if self.automatic is not False:
            raise ValueError(RefusalCode.AUTOMATIC_PUBLISH_REFUSED.value)
        if self.hosted is not False:
            raise ValueError(RefusalCode.HOSTING_REFUSED.value)
        if self.deployed is not False:
            raise ValueError(RefusalCode.DEPLOYMENT_REFUSED.value)
        if self.network_mode is not NetworkMode.NONE:
            raise ValueError(RefusalCode.NETWORK_REFUSED.value)
        if self.external_approval_required is not True:
            raise ValueError(RefusalCode.HUMAN_GATE_NOT_GRANTED.value)
        if self.external_approval_granted_by_foundation is not False:
            raise ValueError(RefusalCode.HUMAN_GATE_NOT_GRANTED.value)

    def to_dict(self) -> dict[str, object]:
        return {
            "draft_id": self.draft_id,
            "authorization": PublishAuthorization.NOT_AUTHORIZED.value,
            "published": False,
            "live": False,
            "automatic": False,
            "hosted": False,
            "deployed": False,
            "network_mode": NetworkMode.NONE.value,
            "status": self.status.value,
            "external_approval_required": True,
            "external_approval_granted_by_foundation": False,
        }


@dataclass(frozen=True)
class PipelineRun:
    phase: PipelinePhase
    network_mode: NetworkMode
    hosting: Literal[False]
    deployment: Literal[False]
    automatic_publish: Literal[False]
    foundation_grants_publish: Literal[False]
    discovery: DiscoveryRecord | None
    generate: GenerateRecord | None
    verify: VerifyRecord | None
    publish: PublishRecord
    refusals: tuple[PipelineRefusal, ...]

    def __post_init__(self) -> None:
        if self.network_mode is not NetworkMode.NONE:
            raise ValueError(RefusalCode.NETWORK_REFUSED.value)
        if self.hosting is not False or self.deployment is not False:
            raise ValueError(RefusalCode.HOSTING_REFUSED.value)
        if self.automatic_publish is not False:
            raise ValueError(RefusalCode.AUTOMATIC_PUBLISH_REFUSED.value)
        if self.foundation_grants_publish is not False:
            raise ValueError(RefusalCode.PUBLISH_NOT_AUTHORIZED.value)
        if self.publish.authorization is not PublishAuthorization.NOT_AUTHORIZED:
            raise ValueError(RefusalCode.PUBLISH_NOT_AUTHORIZED.value)
        if self.publish.published is not False:
            raise ValueError(RefusalCode.LIVE_PUBLISH_REFUSED.value)

    def to_dict(self) -> dict[str, object]:
        return {
            "contract": PIPELINE_CONTRACT_ID,
            "not_a_release": True,
            "phase": self.phase.value,
            "network_mode": NetworkMode.NONE.value,
            "hosting": False,
            "deployment": False,
            "automatic_publish": False,
            "foundation_grants_publish": False,
            "discovery": None if self.discovery is None else self.discovery.to_dict(),
            "generate": None if self.generate is None else self.generate.to_dict(),
            "verify": None if self.verify is None else self.verify.to_dict(),
            "publish": self.publish.to_dict(),
            "refusals": [item.to_dict() for item in self.refusals],
        }


@dataclass(frozen=True)
class DailyLabPipelineRequest:
    """One local pass across the four stages.

    ``external_approval`` is required and cannot be omitted. This foundation
    still will not treat that object as permission to publish.
    """

    candidate_ids: tuple[str, ...]
    specimen_id: str
    verification_verdict: str
    external_approval: ExternalHumanApproval
    network_mode: str = "NONE"
    hosting: bool = False
    deployment: bool = False
    automatic_publish: bool = False
    live_publish: bool = False
    discovery_source: str = DiscoverySource.LOCAL_FINITE_QUEUE.value
    scopes: tuple[str, ...] = ()


def _draft_id(specimen_id: str, candidate_ids: tuple[str, ...]) -> str:
    material = specimen_id + "|" + ",".join(candidate_ids)
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]
    return "local-draft-" + digest


def _stopped(
    phase: PipelinePhase,
    refusals: tuple[PipelineRefusal, ...],
    *,
    publish_status: PublishStatus,
    draft_id: str | None = None,
    discovery: DiscoveryRecord | None = None,
    generate: GenerateRecord | None = None,
    verify: VerifyRecord | None = None,
) -> PipelineRun:
    return PipelineRun(
        phase=phase,
        network_mode=NetworkMode.NONE,
        hosting=False,
        deployment=False,
        automatic_publish=False,
        foundation_grants_publish=False,
        discovery=discovery,
        generate=generate,
        verify=verify,
        publish=PublishRecord(draft_id=draft_id, status=publish_status),
        refusals=refusals,
    )


def _parse_verdict(
    raw: str,
) -> tuple[VerificationVerdict | None, PipelineRefusal | None]:
    token = raw.strip().upper()
    if token == VerificationVerdict.UNKNOWN.value:
        return VerificationVerdict.UNKNOWN, _refusal(
            RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS,
            Stage.VERIFY,
            "verification UNKNOWN is not PASS",
        )
    try:
        verdict = VerificationVerdict(token)
    except ValueError:
        return None, _refusal(
            RefusalCode.VERIFICATION_NOT_PASS,
            Stage.VERIFY,
            "verification verdict is not PASS",
        )
    if verdict is not VerificationVerdict.PASS:
        return verdict, _refusal(
            RefusalCode.VERIFICATION_NOT_PASS,
            Stage.VERIFY,
            f"verification {verdict.value} is not PASS",
        )
    return verdict, None


def _gate_refusals(request: DailyLabPipelineRequest) -> tuple[PipelineRefusal, ...]:
    refusals: list[PipelineRefusal] = []
    for scope in request.scopes:
        if _normalize_scope(scope) in _FORBIDDEN_SCOPES:
            refusals.append(
                _refusal(
                    RefusalCode.FORBIDDEN_SCOPE,
                    Stage.DISCOVERY,
                    "requested scope is outside the Daily Lab pipeline foundation",
                )
            )
            break
    if request.network_mode != NetworkMode.NONE.value:
        refusals.append(
            _refusal(
                RefusalCode.NETWORK_REFUSED,
                Stage.DISCOVERY,
                "network mode must stay NONE",
            )
        )
    if request.hosting:
        refusals.append(
            _refusal(RefusalCode.HOSTING_REFUSED, Stage.PUBLISH, "hosting is refused")
        )
    if request.deployment:
        refusals.append(
            _refusal(
                RefusalCode.DEPLOYMENT_REFUSED,
                Stage.PUBLISH,
                "deployment is refused",
            )
        )
    if request.automatic_publish:
        refusals.append(
            _refusal(
                RefusalCode.AUTOMATIC_PUBLISH_REFUSED,
                Stage.PUBLISH,
                "automatic publish is refused",
            )
        )
    if request.live_publish:
        refusals.append(
            _refusal(
                RefusalCode.LIVE_PUBLISH_REFUSED,
                Stage.PUBLISH,
                "live publish is refused",
            )
        )
    return tuple(refusals)


def _discover(
    request: DailyLabPipelineRequest,
) -> tuple[DiscoveryRecord | None, tuple[PipelineRefusal, ...]]:
    refusals: list[PipelineRefusal] = []
    if request.discovery_source != DiscoverySource.LOCAL_FINITE_QUEUE.value:
        refusals.append(
            _refusal(
                RefusalCode.REMOTE_DISCOVERY_REFUSED,
                Stage.DISCOVERY,
                "discovery source must be the local finite queue",
            )
        )
    ids = tuple(request.candidate_ids)
    if len(ids) == 0:
        refusals.append(
            _refusal(RefusalCode.EMPTY_DISCOVERY, Stage.DISCOVERY, "discovery is empty")
        )
    if len(ids) > FINITE_DAILY_QUEUE_BOUND:
        refusals.append(
            _refusal(
                RefusalCode.UNBOUNDED_DISCOVERY,
                Stage.DISCOVERY,
                f"discovery exceeds the finite queue bound of {FINITE_DAILY_QUEUE_BOUND}",
            )
        )
    if len(ids) != len(set(ids)):
        refusals.append(
            _refusal(
                RefusalCode.DUPLICATE_CANDIDATE,
                Stage.DISCOVERY,
                "discovery candidates must be unique",
            )
        )
    remote = False
    for candidate in ids:
        if "://" in candidate or candidate.lower().startswith("http") or not _CANDIDATE_ID.match(candidate):
            remote = True
            break
    if remote:
        refusals.append(
            _refusal(
                RefusalCode.REMOTE_DISCOVERY_REFUSED,
                Stage.DISCOVERY,
                "discovery candidates must be local finite-queue ids",
            )
        )
    if request.specimen_id not in ids:
        refusals.append(
            _refusal(
                RefusalCode.SPECIMEN_NOT_IN_DISCOVERY,
                Stage.DISCOVERY,
                "specimen is not in the discovered finite set",
            )
        )
    if refusals:
        return None, tuple(refusals)
    return (
        DiscoveryRecord(
            source=DiscoverySource.LOCAL_FINITE_QUEUE,
            network_mode=NetworkMode.NONE,
            candidate_ids=ids,
            status="COMPLETE",
        ),
        (),
    )


def hold_publish(
    verify: VerifyRecord,
    external_approval: ExternalHumanApproval,
) -> tuple[PublishRecord, tuple[PipelineRefusal, ...]]:
    """Hold a verified draft. External approval is required and not granted.

    The approval argument is mandatory so a later human gate has a typed
    slot. This function does not read a granted decision out of it.
    """

    if not isinstance(external_approval, ExternalHumanApproval):
        receipt = PublishRecord(draft_id=verify.draft_id, status=PublishStatus.REFUSED)
        return receipt, (
            _refusal(
                RefusalCode.HUMAN_GATE_NOT_GRANTED,
                Stage.PUBLISH,
                "publish requires ExternalHumanApproval and this foundation does not grant it",
            ),
        )
    if external_approval.decision != "NOT_GRANTED":
        receipt = PublishRecord(draft_id=verify.draft_id, status=PublishStatus.REFUSED)
        return receipt, (
            _refusal(
                RefusalCode.HUMAN_GATE_NOT_GRANTED,
                Stage.PUBLISH,
                "this foundation does not grant external human approval",
            ),
        )
    if not verify.counts_as_pass or verify.verdict is not VerificationVerdict.PASS:
        code = (
            RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS
            if verify.verdict is VerificationVerdict.UNKNOWN
            else RefusalCode.VERIFICATION_NOT_PASS
        )
        return (
            PublishRecord(draft_id=verify.draft_id, status=PublishStatus.NOT_STARTED),
            (
                _refusal(
                    code,
                    Stage.VERIFY,
                    "publish is not entered because verification is not PASS",
                ),
            ),
        )
    return (
        PublishRecord(draft_id=verify.draft_id, status=PublishStatus.HELD),
        (
            _refusal(
                RefusalCode.PUBLISH_NOT_AUTHORIZED,
                Stage.PUBLISH,
                "external human approval is required and is not granted by this foundation",
            ),
        ),
    )


def run_daily_lab_pipeline(request: DailyLabPipelineRequest) -> PipelineRun:
    """Walk discovery → generate → verify → publish hold.

    Every returned run has network NONE, no hosting, no deployment, and
    publish authorization NOT_AUTHORIZED.
    """

    if not isinstance(request.external_approval, ExternalHumanApproval):
        return _stopped(
            PipelinePhase.REFUSED,
            (
                _refusal(
                    RefusalCode.HUMAN_GATE_NOT_GRANTED,
                    Stage.PUBLISH,
                    "external human approval is required and is not granted by this foundation",
                ),
            ),
            publish_status=PublishStatus.REFUSED,
        )

    blocked = _gate_refusals(request)
    if blocked:
        return _stopped(
            PipelinePhase.REFUSED,
            blocked,
            publish_status=PublishStatus.REFUSED,
        )

    ok, phase, transition_code = propose_phase(
        PipelinePhase.NOT_STARTED, PipelinePhase.DISCOVERY.value
    )
    if not ok or phase is None:
        return _stopped(
            PipelinePhase.REFUSED,
            (
                _refusal(
                    transition_code or RefusalCode.ILLEGAL_TRANSITION,
                    Stage.DISCOVERY,
                    "discovery transition refused",
                ),
            ),
            publish_status=PublishStatus.REFUSED,
        )

    discovery, discovery_refusals = _discover(request)
    if discovery is None:
        moved, _, _ = propose_phase(phase, PipelinePhase.REFUSED.value)
        if not moved:
            raise RuntimeError(RefusalCode.ILLEGAL_TRANSITION.value)
        return _stopped(
            PipelinePhase.REFUSED,
            discovery_refusals,
            publish_status=PublishStatus.NOT_STARTED,
        )

    ok, phase, transition_code = propose_phase(phase, PipelinePhase.GENERATE.value)
    if not ok or phase is None:
        return _stopped(
            PipelinePhase.REFUSED,
            (
                _refusal(
                    transition_code or RefusalCode.STAGE_SKIP_REFUSED,
                    Stage.GENERATE,
                    "generate cannot start without discovery",
                ),
            ),
            publish_status=PublishStatus.NOT_STARTED,
            discovery=discovery,
        )

    draft_id = _draft_id(request.specimen_id, discovery.candidate_ids)
    generated = GenerateRecord(
        draft_id=draft_id,
        specimen_id=request.specimen_id,
        artifact_kind="LOCAL_DRAFT",
        network_mode=NetworkMode.NONE,
        hosted=False,
        deployed=False,
        status="COMPLETE",
    )

    ok, phase, transition_code = propose_phase(phase, PipelinePhase.VERIFY.value)
    if not ok or phase is None:
        return _stopped(
            PipelinePhase.REFUSED,
            (
                _refusal(
                    transition_code or RefusalCode.STAGE_SKIP_REFUSED,
                    Stage.VERIFY,
                    "verify cannot start without a local draft",
                ),
            ),
            publish_status=PublishStatus.NOT_STARTED,
            discovery=discovery,
            generate=generated,
        )

    verdict, verify_refusal = _parse_verdict(request.verification_verdict)
    if verdict is None or verify_refusal is not None:
        verify = None
        if verdict is not None:
            verify = VerifyRecord(
                draft_id=draft_id,
                verdict=verdict,
                counts_as_pass=False,
                status="REFUSED",
            )
        return _stopped(
            PipelinePhase.REFUSED,
            (verify_refusal,) if verify_refusal is not None else (),
            publish_status=PublishStatus.NOT_STARTED,
            draft_id=draft_id,
            discovery=discovery,
            generate=generated,
            verify=verify,
        )

    verified = VerifyRecord(
        draft_id=draft_id,
        verdict=VerificationVerdict.PASS,
        counts_as_pass=True,
        status="COMPLETE",
    )
    ok, phase, transition_code = propose_phase(phase, PipelinePhase.PUBLISH_HELD.value)
    if not ok or phase is not PipelinePhase.PUBLISH_HELD:
        return _stopped(
            PipelinePhase.REFUSED,
            (
                _refusal(
                    transition_code or RefusalCode.ILLEGAL_TRANSITION,
                    Stage.PUBLISH,
                    "publish hold transition refused",
                ),
            ),
            publish_status=PublishStatus.REFUSED,
            draft_id=draft_id,
            discovery=discovery,
            generate=generated,
            verify=verified,
        )

    receipt, publish_refusals = hold_publish(verified, request.external_approval)
    return PipelineRun(
        phase=PipelinePhase.PUBLISH_HELD,
        network_mode=NetworkMode.NONE,
        hosting=False,
        deployment=False,
        automatic_publish=False,
        foundation_grants_publish=False,
        discovery=discovery,
        generate=generated,
        verify=verified,
        publish=receipt,
        refusals=publish_refusals,
    )
