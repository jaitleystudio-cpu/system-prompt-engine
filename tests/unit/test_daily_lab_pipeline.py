"""Daily 3D Lab pipeline boundary: local stages, no live publish."""

from __future__ import annotations

from pathlib import Path

import jsonschema
import pytest

from spe_runtime.lab.contract import (
    FINITE_DAILY_QUEUE_BOUND,
    PIPELINE_CONTRACT_ID,
    DailyLabPipelineRequest,
    ExternalHumanApproval,
    NetworkMode,
    PipelinePhase,
    PublishAuthorization,
    PublishRecord,
    PublishStatus,
    RefusalCode,
    VerificationVerdict,
    hold_publish,
    propose_phase,
    run_daily_lab_pipeline,
    verification_counts_as_pass,
)
from spe_runtime.lab.contract import VerifyRecord

REPO = Path(__file__).resolve().parents[2]
SCHEMA = REPO / "schemas" / "daily_lab_pipeline.schema.json"
CONTRACT = REPO / "spe_runtime" / "lab" / "contract.py"
SPECIMENS = REPO / "apps" / "web" / "src" / "lab" / "specimens.ts"


def _approval() -> ExternalHumanApproval:
    return ExternalHumanApproval(gate_id="gate-later", approver_ref="human:external")


def _request(**overrides: object) -> DailyLabPipelineRequest:
    base: dict[str, object] = dict(
        candidate_ids=("d3d-01", "d3d-02", "d3d-03"),
        specimen_id="d3d-01",
        verification_verdict="PASS",
        external_approval=_approval(),
    )
    base.update(overrides)
    return DailyLabPipelineRequest(**base)  # type: ignore[arg-type]


def test_contract_id_and_finite_bound_match_existing_queue():
    assert PIPELINE_CONTRACT_ID == "spe.daily-lab-pipeline.v1"
    specimens = SPECIMENS.read_text(encoding="utf-8")
    assert specimens.count('id: "d3d-') == FINITE_DAILY_QUEUE_BOUND == 14
    assert "DAILY_3D_QUEUE" in specimens


def test_publish_authorization_has_no_granted_member():
    assert [item.value for item in PublishAuthorization] == ["NOT_AUTHORIZED"]
    with pytest.raises(ValueError):
        PublishAuthorization("AUTHORIZED")
    assert "PUBLISHED" not in {item.value for item in PipelinePhase}


def test_pass_still_holds_publish_unauthorized():
    run = run_daily_lab_pipeline(_request())
    assert run.phase is PipelinePhase.PUBLISH_HELD
    assert run.network_mode is NetworkMode.NONE
    assert run.hosting is False
    assert run.deployment is False
    assert run.automatic_publish is False
    assert run.foundation_grants_publish is False
    assert run.discovery is not None and run.discovery.status == "COMPLETE"
    assert run.generate is not None
    assert run.generate.artifact_kind == "LOCAL_DRAFT"
    assert run.generate.hosted is False and run.generate.deployed is False
    assert run.verify is not None
    assert run.verify.verdict is VerificationVerdict.PASS
    assert run.verify.counts_as_pass is True
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert run.publish.published is False
    assert run.publish.live is False
    assert run.publish.status is PublishStatus.HELD
    assert run.publish.external_approval_required is True
    assert run.publish.external_approval_granted_by_foundation is False
    assert [item.code for item in run.refusals] == [RefusalCode.PUBLISH_NOT_AUTHORIZED]
    payload = run.to_dict()
    jsonschema.validate(payload, _schema())
    assert payload["publish"]["authorization"] == "NOT_AUTHORIZED"
    assert payload["foundation_grants_publish"] is False


def test_unknown_verification_is_not_pass_and_does_not_publish():
    run = run_daily_lab_pipeline(_request(verification_verdict="UNKNOWN"))
    assert run.phase is PipelinePhase.REFUSED
    assert run.verify is not None
    assert run.verify.verdict is VerificationVerdict.UNKNOWN
    assert run.verify.counts_as_pass is False
    assert verification_counts_as_pass(VerificationVerdict.UNKNOWN) is False
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert run.publish.published is False
    assert run.publish.status is PublishStatus.NOT_STARTED
    assert run.refusals[0].code is RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS
    jsonschema.validate(run.to_dict(), _schema())


@pytest.mark.parametrize("verdict", ["FAIL", "NOT_RUN", "MAYBE"])
def test_non_pass_verification_refuses_before_publish(verdict: str):
    run = run_daily_lab_pipeline(_request(verification_verdict=verdict))
    assert run.phase is PipelinePhase.REFUSED
    assert run.publish.published is False
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert run.refusals[0].code is RefusalCode.VERIFICATION_NOT_PASS
    if verdict == "MAYBE":
        assert run.verify is None
    else:
        assert run.verify is not None and run.verify.counts_as_pass is False


@pytest.mark.parametrize(
    ("flag", "code"),
    [
        ({"network_mode": "WAN"}, RefusalCode.NETWORK_REFUSED),
        ({"hosting": True}, RefusalCode.HOSTING_REFUSED),
        ({"deployment": True}, RefusalCode.DEPLOYMENT_REFUSED),
        ({"automatic_publish": True}, RefusalCode.AUTOMATIC_PUBLISH_REFUSED),
        ({"live_publish": True}, RefusalCode.LIVE_PUBLISH_REFUSED),
    ],
)
def test_live_paths_refuse_and_stay_unauthorized(flag: dict[str, object], code: RefusalCode):
    run = run_daily_lab_pipeline(_request(**flag))
    assert run.phase is PipelinePhase.REFUSED
    assert run.discovery is None
    assert run.generate is None
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert run.publish.published is False
    assert run.publish.live is False
    assert run.publish.hosted is False
    assert run.publish.deployed is False
    assert run.network_mode is NetworkMode.NONE
    assert code in {item.code for item in run.refusals}
    jsonschema.validate(run.to_dict(), _schema())


@pytest.mark.parametrize(
    "scope",
    [
        "Adaptive Cognitive Evolution",
        "meta-brain",
        "Champion/Challenger",
        "success_genome",
    ],
)
def test_forbidden_scopes_refuse(scope: str):
    run = run_daily_lab_pipeline(_request(scopes=(scope,)))
    assert run.phase is PipelinePhase.REFUSED
    assert run.refusals[0].code is RefusalCode.FORBIDDEN_SCOPE
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED


def test_discovery_refusals():
    empty = run_daily_lab_pipeline(_request(candidate_ids=(), specimen_id="d3d-01"))
    assert RefusalCode.EMPTY_DISCOVERY in {item.code for item in empty.refusals}

    unbounded = tuple(f"d3d-{i:02d}" for i in range(1, 16))
    wide = run_daily_lab_pipeline(
        _request(candidate_ids=unbounded, specimen_id="d3d-01")
    )
    assert RefusalCode.UNBOUNDED_DISCOVERY in {item.code for item in wide.refusals}

    dup = run_daily_lab_pipeline(
        _request(candidate_ids=("d3d-01", "d3d-01"), specimen_id="d3d-01")
    )
    assert RefusalCode.DUPLICATE_CANDIDATE in {item.code for item in dup.refusals}

    remote = run_daily_lab_pipeline(
        _request(candidate_ids=("https://example.test/a",), specimen_id="https://example.test/a")
    )
    assert RefusalCode.REMOTE_DISCOVERY_REFUSED in {item.code for item in remote.refusals}

    source = run_daily_lab_pipeline(_request(discovery_source="REMOTE_FEED"))
    assert RefusalCode.REMOTE_DISCOVERY_REFUSED in {item.code for item in source.refusals}

    missing = run_daily_lab_pipeline(_request(specimen_id="d3d-99"))
    assert RefusalCode.SPECIMEN_NOT_IN_DISCOVERY in {item.code for item in missing.refusals}

    for run in (empty, wide, dup, remote, source, missing):
        assert run.publish.published is False
        assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
        assert run.phase is PipelinePhase.REFUSED


def test_external_approval_cannot_be_granted_here():
    with pytest.raises(ValueError, match="HUMAN_GATE_NOT_GRANTED"):
        ExternalHumanApproval(
            gate_id="gate-later",
            approver_ref="human:external",
            decision="GRANTED",  # type: ignore[arg-type]
        )
    with pytest.raises(ValueError, match="HUMAN_GATE_NOT_GRANTED"):
        ExternalHumanApproval(gate_id="", approver_ref="human:external")
    forged = _request()
    object.__setattr__(forged, "external_approval", object())
    run = run_daily_lab_pipeline(forged)
    assert run.refusals[0].code is RefusalCode.HUMAN_GATE_NOT_GRANTED
    assert run.publish.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert run.publish.published is False


def test_publish_record_rejects_live_and_granted_flags():
    with pytest.raises(ValueError):
        PublishRecord(draft_id="local-draft-x", published=True)
    with pytest.raises(ValueError):
        PublishRecord(draft_id="local-draft-x", live=True)
    with pytest.raises(ValueError):
        PublishRecord(
            draft_id="local-draft-x",
            external_approval_granted_by_foundation=True,
        )


def test_phase_machine_blocks_publish_and_skips():
    ok, _phase, code = propose_phase(PipelinePhase.PUBLISH_HELD, "PUBLISHED")
    assert ok is False
    assert code is RefusalCode.LIVE_PUBLISH_REFUSED
    ok, _phase, code = propose_phase(PipelinePhase.NOT_STARTED, "GENERATE")
    assert ok is False
    assert code is RefusalCode.STAGE_SKIP_REFUSED
    ok, held, code = propose_phase(PipelinePhase.VERIFY, "PUBLISH_HELD")
    assert ok is True and held is PipelinePhase.PUBLISH_HELD and code is None


def test_hold_publish_requires_approval_and_still_refuses():
    verified = VerifyRecord(
        draft_id="local-draft-abc",
        verdict=VerificationVerdict.PASS,
        counts_as_pass=True,
        status="COMPLETE",
    )
    receipt, refusals = hold_publish(verified, _approval())
    assert receipt.status is PublishStatus.HELD
    assert receipt.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert receipt.published is False
    assert refusals[0].code is RefusalCode.PUBLISH_NOT_AUTHORIZED

    unknown = VerifyRecord(
        draft_id="local-draft-abc",
        verdict=VerificationVerdict.UNKNOWN,
        counts_as_pass=False,
        status="REFUSED",
    )
    with pytest.raises(ValueError):
        VerifyRecord(
            draft_id="local-draft-abc",
            verdict=VerificationVerdict.UNKNOWN,
            counts_as_pass=True,
            status="REFUSED",
        )
    receipt, refusals = hold_publish(unknown, _approval())
    assert receipt.published is False
    assert receipt.authorization is PublishAuthorization.NOT_AUTHORIZED
    assert refusals[0].code is RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS


def test_contract_module_does_not_import_network_or_other_kernels():
    text = CONTRACT.read_text(encoding="utf-8")
    imports = [
        line
        for line in text.splitlines()
        if line.startswith("import ") or line.startswith("from ")
    ]
    blob = "\n".join(imports)
    for banned in ("xcat", "k3", "quality", "urllib", "requests", "socket", "http"):
        assert banned not in blob
    assert "npx convex deploy" not in text
    assert "PUBLISHED" not in {item.value for item in PipelinePhase}


def _schema() -> dict[str, object]:
    import json

    return json.loads(SCHEMA.read_text(encoding="utf-8"))


def test_schema_rejects_an_authorized_publish_receipt():
    run = run_daily_lab_pipeline(_request())
    payload = run.to_dict()
    payload["publish"]["authorization"] = "AUTHORIZED"
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, _schema())
    payload = run.to_dict()
    assert payload["verify"] is not None
    payload["verify"]["verdict"] = "UNKNOWN"
    payload["verify"]["counts_as_pass"] = True
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, _schema())
