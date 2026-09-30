"""Read-only Daily Lab R1 laws.

The donor module is passed in. This file does not modify it and does not
open a network connection. A non-empty return is a qualification violation.
"""

from __future__ import annotations

import re
from typing import Mapping

import jsonschema
from jsonschema import ValidationError

_BLOCKED_PHASES = frozenset(
    {"PUBLISHED", "LIVE", "DEPLOYED", "AUTO_APPROVED", "HOSTED", "AUTHORIZED"}
)
_QUEUE_IDS = tuple(f"d3d-{index:02d}" for index in range(1, 15))
_SPECIMEN_IDS = re.compile(r'id: "(d3d-\d{2})"')


def _mark(found: list[str], tag: str) -> None:
    if tag not in found:
        found.append(tag)


def _request(mod: object, **overrides: object) -> object:
    base: dict[str, object] = {
        "candidate_ids": ("d3d-01", "d3d-02", "d3d-03"),
        "specimen_id": "d3d-01",
        "verification_verdict": "PASS",
        "external_approval": mod.ExternalHumanApproval(  # type: ignore[attr-defined]
            gate_id="gate-later",
            approver_ref="human:external",
        ),
    }
    base.update(overrides)
    return mod.DailyLabPipelineRequest(**base)  # type: ignore[attr-defined]


def _run(mod: object, **overrides: object) -> object:
    return mod.run_daily_lab_pipeline(_request(mod, **overrides))  # type: ignore[attr-defined]


def _safe_run(mod: object, found: list[str], tag: str, **overrides: object) -> object | None:
    try:
        return _run(mod, **overrides)
    except Exception:
        _mark(found, tag)
        return None


def _codes(run: object) -> set[object]:
    return {item.code for item in run.refusals}  # type: ignore[attr-defined]


def _walk(value: object) -> tuple[list[str], list[str]]:
    keys: list[str] = []
    strings: list[str] = []

    def visit(item: object) -> None:
        if isinstance(item, dict):
            for key, child in item.items():
                keys.append(str(key))
                visit(child)
        elif isinstance(item, list):
            for child in item:
                visit(child)
        elif isinstance(item, str):
            strings.append(item)

    visit(value)
    return keys, strings


def _inspect_receipt(found: list[str], run: object, schema: Mapping[str, object]) -> None:
    payload = run.to_dict()  # type: ignore[attr-defined]
    publish = payload["publish"]
    keys, strings = _walk(payload)
    if payload["phase"] not in {
        "NOT_STARTED",
        "DISCOVERY",
        "GENERATE",
        "VERIFY",
        "PUBLISH_HELD",
        "REFUSED",
    }:
        _mark(found, "PUBLISH_STATE")
    if payload["phase"] in _BLOCKED_PHASES:
        _mark(found, "PUBLISH_STATE")
        _mark(found, "STATES")
    if payload["not_a_release"] is not True:
        _mark(found, "PUBLISH_STATE")
    if payload["network_mode"] != "NONE" or publish["network_mode"] != "NONE":
        _mark(found, "NETWORK_MODE")
    if payload["foundation_grants_publish"] is not False:
        _mark(found, "AUTHORITY")
    if publish["authorization"] != "NOT_AUTHORIZED":
        _mark(found, "AUTHORITY")
    if publish["external_approval_granted_by_foundation"] is not False:
        _mark(found, "APPROVAL")
    if (
        publish["published"] is not False
        or publish["live"] is not False
        or publish["automatic"] is not False
        or payload["automatic_publish"] is not False
    ):
        _mark(found, "PUBLISH_INVOKED")
    if (
        payload["deployment"] is not False
        or payload["hosting"] is not False
        or publish["deployed"] is not False
        or publish["hosted"] is not False
    ):
        _mark(found, "DEPLOYMENT")
    if "social_post" in keys or any("social" in key for key in keys):
        _mark(found, "SOCIAL")
    if any("analytics" in key or "beacon" in key for key in keys) or any(
        "://" in item for item in strings
    ):
        _mark(found, "ANALYTICS")
    if "winner" in keys:
        _mark(found, "MISSING_EVIDENCE")
    if publish["status"] in _BLOCKED_PHASES:
        _mark(found, "PUBLISH_STATE")
    try:
        jsonschema.validate(payload, schema)
    except ValidationError:
        _mark(found, "SCHEMA_RECEIPT")


def _queue_marks(found: list[str], specimens_text: str) -> None:
    ids = _SPECIMEN_IDS.findall(specimens_text)
    if ids != list(_QUEUE_IDS) or len(ids) != 14:
        _mark(found, "QUEUE_SIZE")
    if len(ids) != len(set(ids)):
        _mark(found, "DUPLICATE")
    for mutation in (
        "DAILY_3D_QUEUE.push",
        "DAILY_3D_QUEUE.splice",
        "DAILY_3D_QUEUE.unshift",
        "DAILY_3D_QUEUE.length =",
    ):
        if mutation in specimens_text:
            _mark(found, "QUEUE_SIZE")


def _enum_marks(found: list[str], mod: object) -> None:
    phases = {item.value for item in mod.PipelinePhase}  # type: ignore[attr-defined]
    if phases != {
        "NOT_STARTED",
        "DISCOVERY",
        "GENERATE",
        "VERIFY",
        "PUBLISH_HELD",
        "REFUSED",
    }:
        _mark(found, "STATES")
    if phases & _BLOCKED_PHASES:
        _mark(found, "STATES")
    if {item.value for item in mod.PublishStatus} != {"NOT_STARTED", "HELD", "REFUSED"}:  # type: ignore[attr-defined]
        _mark(found, "PUBLISH_STATE")
    if {item.value for item in mod.PublishAuthorization} != {"NOT_AUTHORIZED"}:  # type: ignore[attr-defined]
        _mark(found, "AUTHORITY")
    if {item.value for item in mod.VerificationVerdict} != {"NOT_RUN", "UNKNOWN", "FAIL", "PASS"}:  # type: ignore[attr-defined]
        _mark(found, "UNKNOWN_LAW")
    if {item.value for item in mod.NetworkMode} != {"NONE"}:  # type: ignore[attr-defined]
        _mark(found, "NETWORK_MODE")
    counts = mod.verification_counts_as_pass  # type: ignore[attr-defined]
    verdict = mod.VerificationVerdict  # type: ignore[attr-defined]
    if counts(verdict.UNKNOWN) is not False or counts(verdict.FAIL) is not False:
        _mark(found, "UNKNOWN_LAW")
    if counts(verdict.NOT_RUN) is not False or counts(verdict.PASS) is not True:
        _mark(found, "UNKNOWN_LAW")
    if mod.FINITE_DAILY_QUEUE_BOUND != 14:  # type: ignore[attr-defined]
        _mark(found, "BUDGET_BOUND")


def _reject_constructors(found: list[str], mod: object) -> None:
    probes = (
        (lambda: mod.PipelinePhase("PUBLISHED"), "STATES"),  # type: ignore[attr-defined]
        (lambda: mod.PipelinePhase("LIVE"), "STATES"),  # type: ignore[attr-defined]
        (lambda: mod.PipelinePhase("DEPLOYED"), "STATES"),  # type: ignore[attr-defined]
        (lambda: mod.PipelinePhase("AUTO_APPROVED"), "STATES"),  # type: ignore[attr-defined]
        (lambda: mod.NetworkMode("WAN"), "NETWORK_MODE"),  # type: ignore[attr-defined]
        (lambda: mod.PublishAuthorization("AUTHORIZED"), "AUTHORITY"),  # type: ignore[attr-defined]
        (lambda: mod.PublishAuthorization("AUTO_APPROVED"), "AUTHORITY"),  # type: ignore[attr-defined]
        (lambda: mod.PublishRecord(draft_id="local-draft-x", published=True), "PUBLISH_INVOKED"),  # type: ignore[attr-defined]
        (lambda: mod.PublishRecord(draft_id="local-draft-x", live=True), "PUBLISH_INVOKED"),  # type: ignore[attr-defined]
        (lambda: mod.PublishRecord(draft_id="local-draft-x", deployed=True), "DEPLOYMENT"),  # type: ignore[attr-defined]
        (
            lambda: mod.PublishRecord(  # type: ignore[attr-defined]
                draft_id="local-draft-x",
                external_approval_granted_by_foundation=True,
            ),
            "APPROVAL",
        ),
        (
            lambda: mod.ExternalHumanApproval(  # type: ignore[attr-defined]
                gate_id="gate-later",
                approver_ref="human:external",
                decision="GRANTED",
            ),
            "APPROVAL",
        ),
    )
    for build, tag in probes:
        try:
            build()
        except (TypeError, ValueError):
            continue
        _mark(found, tag)
    try:
        mod.ExternalHumanApproval(  # type: ignore[attr-defined]
            gate_id="gate-later",
            approver_ref="human:external",
            approved=True,
        )
    except TypeError:
        pass
    else:
        _mark(found, "APPROVAL")


def _transition_marks(found: list[str], mod: object) -> None:
    phase = mod.PipelinePhase.NOT_STARTED  # type: ignore[attr-defined]
    for step, name in enumerate(("DISCOVERY", "GENERATE", "VERIFY", "PUBLISH_HELD"), start=1):
        if step > 6:
            _mark(found, "NO_PROGRESS_LOOP")
            return
        ok, nxt, _code = mod.propose_phase(phase, name)  # type: ignore[attr-defined]
        if not ok or nxt is None or nxt is phase:
            _mark(found, "STATES")
            return
        phase = nxt
    if phase is not mod.PipelinePhase.PUBLISH_HELD:  # type: ignore[attr-defined]
        _mark(found, "STATES")
    ok_self, stayed, _code = mod.propose_phase(phase, "PUBLISH_HELD")  # type: ignore[attr-defined]
    if ok_self and stayed is not phase:
        _mark(found, "PUBLISH_STATE")
    for current in mod.PipelinePhase:  # type: ignore[attr-defined]
        for blocked in _BLOCKED_PHASES:
            ok_block, _nxt, _code = mod.propose_phase(current, blocked)  # type: ignore[attr-defined]
            if ok_block:
                _mark(found, "STATES")


def _schema_bounds(found: list[str], schema: Mapping[str, object]) -> None:
    properties = schema["properties"]
    assert isinstance(properties, dict)
    phase_enum = properties["phase"]["enum"]  # type: ignore[index]
    if set(phase_enum) != {
        "NOT_STARTED",
        "DISCOVERY",
        "GENERATE",
        "VERIFY",
        "PUBLISH_HELD",
        "REFUSED",
    }:
        _mark(found, "STATES")
    if properties["network_mode"]["const"] != "NONE":  # type: ignore[index]
        _mark(found, "NETWORK_MODE")
    publish = properties["publish"]["properties"]  # type: ignore[index]
    if publish["authorization"]["const"] != "NOT_AUTHORIZED":
        _mark(found, "AUTHORITY")
    if publish["published"]["const"] is not False or publish["live"]["const"] is not False:
        _mark(found, "PUBLISH_INVOKED")
    if publish["deployed"]["const"] is not False:
        _mark(found, "DEPLOYMENT")
    discovery = properties["discovery"]["anyOf"][1]["properties"]["candidate_ids"]  # type: ignore[index]
    if discovery["maxItems"] != 14:
        _mark(found, "BUDGET_BOUND")


def collect_violations(
    mod: object,
    contract_text: str,
    specimens_text: str,
    schema: Mapping[str, object],
) -> list[str]:
    """Return law tags the module breaks. Empty means the donor laws hold."""

    found: list[str] = []
    if any(
        token in contract_text
        for token in (
            "urlopen",
            "urllib",
            "import socket",
            "import requests",
            "http.client",
            "sendBeacon",
        )
    ):
        _mark(found, "EXTERNAL_EFFECT")
        return found
    if re.search(r"while\s+True", contract_text):
        _mark(found, "NO_PROGRESS_LOOP")
        return found
    if re.search(r"\bwhile\b", contract_text):
        _mark(found, "UNBOUNDED_RETRY")

    _queue_marks(found, specimens_text)
    _enum_marks(found, mod)
    _reject_constructors(found, mod)
    _transition_marks(found, mod)
    _schema_bounds(found, schema)

    happy = _safe_run(mod, found, "FAILURE_DISCARDED")
    if happy is not None:
        _inspect_receipt(found, happy, schema)
        if happy.phase is not mod.PipelinePhase.PUBLISH_HELD:  # type: ignore[attr-defined]
            if mod.RefusalCode.UNBOUNDED_DISCOVERY in _codes(happy):  # type: ignore[attr-defined]
                _mark(found, "UNBOUNDED_RETRY")
        else:
            if mod.RefusalCode.PUBLISH_NOT_AUTHORIZED not in _codes(happy):  # type: ignore[attr-defined]
                _mark(found, "FAILURE_DISCARDED")
            if happy.publish.status is not mod.PublishStatus.HELD:  # type: ignore[attr-defined]
                _mark(found, "PUBLISH_STATE")
        if happy.generate is not None and happy.verify is not None:
            drafts = {
                happy.generate.draft_id,
                happy.verify.draft_id,
                happy.publish.draft_id,
            }
            if len(drafts) != 1 or not happy.generate.draft_id:
                _mark(found, "STALE_EVIDENCE")
            if happy.verify.verdict is not mod.VerificationVerdict.PASS or happy.verify.counts_as_pass is not True:  # type: ignore[attr-defined]
                _mark(found, "MISSING_EVIDENCE")

    unknown = _safe_run(mod, found, "UNKNOWN_LAW", verification_verdict="UNKNOWN")
    if unknown is not None:
        _inspect_receipt(found, unknown, schema)
        if unknown.phase is mod.PipelinePhase.PUBLISH_HELD or (  # type: ignore[attr-defined]
            unknown.verify is not None and unknown.verify.verdict is mod.VerificationVerdict.PASS  # type: ignore[attr-defined]
        ):
            _mark(found, "VERIFICATION_SKIPPED")
        if unknown.verify is not None and unknown.verify.verdict is mod.VerificationVerdict.UNKNOWN:  # type: ignore[attr-defined]
            if unknown.verify.counts_as_pass:
                _mark(found, "UNKNOWN_LAW")
            if mod.RefusalCode.VERIFICATION_UNKNOWN_NOT_PASS not in _codes(unknown):  # type: ignore[attr-defined]
                _mark(found, "FAILURE_DISCARDED")
        if unknown.phase is mod.PipelinePhase.REFUSED and not unknown.refusals:  # type: ignore[attr-defined]
            _mark(found, "FAILURE_DISCARDED")

    for raw in ("FAIL", "NOT_RUN"):
        failed = _safe_run(mod, found, "FAILED_PROTOTYPE", verification_verdict=raw)
        if failed is None:
            continue
        _inspect_receipt(found, failed, schema)
        promoted = failed.phase is mod.PipelinePhase.PUBLISH_HELD or (  # type: ignore[attr-defined]
            failed.verify is not None
            and (failed.verify.verdict is mod.VerificationVerdict.PASS or failed.verify.counts_as_pass)  # type: ignore[attr-defined]
        )
        if promoted:
            _mark(found, "FAILED_PROTOTYPE")
        elif failed.phase is not mod.PipelinePhase.REFUSED or not failed.refusals:  # type: ignore[attr-defined]
            _mark(found, "FAILURE_DISCARDED")

    missing = _safe_run(mod, found, "MISSING_EVIDENCE", verification_verdict="")
    if missing is not None:
        _inspect_receipt(found, missing, schema)
        claimed = missing.phase is mod.PipelinePhase.PUBLISH_HELD or (  # type: ignore[attr-defined]
            missing.verify is not None and missing.verify.counts_as_pass
        )
        if claimed or missing.to_dict()["publish"]["published"] is True:
            _mark(found, "MISSING_EVIDENCE")

    wide_ids = tuple(f"d3d-{index:02d}" for index in range(1, 16))
    wide = _safe_run(mod, found, "QUEUE_SIZE", candidate_ids=wide_ids, specimen_id="d3d-01")
    if wide is not None:
        _inspect_receipt(found, wide, schema)
        if wide.phase is mod.PipelinePhase.PUBLISH_HELD or (  # type: ignore[attr-defined]
            mod.RefusalCode.UNBOUNDED_DISCOVERY not in _codes(wide)  # type: ignore[attr-defined]
        ):
            _mark(found, "QUEUE_SIZE")

    duplicate = _safe_run(
        mod,
        found,
        "DUPLICATE",
        candidate_ids=("d3d-01", "d3d-01"),
        specimen_id="d3d-01",
    )
    if duplicate is not None:
        _inspect_receipt(found, duplicate, schema)
        if duplicate.phase is mod.PipelinePhase.PUBLISH_HELD or (  # type: ignore[attr-defined]
            mod.RefusalCode.DUPLICATE_CANDIDATE not in _codes(duplicate)  # type: ignore[attr-defined]
        ):
            _mark(found, "DUPLICATE")

    wan = _safe_run(mod, found, "NETWORK_MODE", network_mode="WAN")
    if wan is not None:
        _inspect_receipt(found, wan, schema)
        if (
            wan.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or wan.network_mode is not mod.NetworkMode.NONE  # type: ignore[attr-defined]
            or mod.RefusalCode.NETWORK_REFUSED not in _codes(wan)  # type: ignore[attr-defined]
        ):
            _mark(found, "NETWORK_MODE")

    deployed = _safe_run(mod, found, "DEPLOYMENT", deployment=True)
    if deployed is not None:
        _inspect_receipt(found, deployed, schema)
        payload = deployed.to_dict()
        if (
            deployed.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or payload["deployment"] is not False
            or payload["publish"]["deployed"] is not False
            or mod.RefusalCode.DEPLOYMENT_REFUSED not in _codes(deployed)  # type: ignore[attr-defined]
        ):
            _mark(found, "DEPLOYMENT")

    hosted = _safe_run(mod, found, "DEPLOYMENT", hosting=True)
    if hosted is not None:
        _inspect_receipt(found, hosted, schema)
        payload = hosted.to_dict()
        if (
            hosted.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or payload["hosting"] is not False
            or payload["publish"]["hosted"] is not False
            or mod.RefusalCode.HOSTING_REFUSED not in _codes(hosted)  # type: ignore[attr-defined]
        ):
            _mark(found, "DEPLOYMENT")

    live = _safe_run(mod, found, "PUBLISH_INVOKED", live_publish=True)
    if live is not None:
        _inspect_receipt(found, live, schema)
        payload = live.to_dict()
        if (
            live.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or payload["publish"]["published"] is not False
            or payload["publish"]["live"] is not False
            or mod.RefusalCode.LIVE_PUBLISH_REFUSED not in _codes(live)  # type: ignore[attr-defined]
        ):
            _mark(found, "PUBLISH_INVOKED")

    automatic = _safe_run(mod, found, "PUBLISH_INVOKED", automatic_publish=True)
    if automatic is not None:
        _inspect_receipt(found, automatic, schema)
        payload = automatic.to_dict()
        if (
            automatic.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or payload["automatic_publish"] is not False
            or payload["publish"]["published"] is not False
            or mod.RefusalCode.AUTOMATIC_PUBLISH_REFUSED not in _codes(automatic)  # type: ignore[attr-defined]
        ):
            _mark(found, "PUBLISH_INVOKED")

    forged_request = _request(mod)

    class _ForgedApproval:
        decision = "GRANTED"
        approved = True

    object.__setattr__(forged_request, "external_approval", _ForgedApproval())
    try:
        forged = mod.run_daily_lab_pipeline(forged_request)  # type: ignore[attr-defined]
    except Exception:
        _mark(found, "APPROVAL")
    else:
        _inspect_receipt(found, forged, schema)
        payload = forged.to_dict()
        if (
            forged.phase is mod.PipelinePhase.PUBLISH_HELD  # type: ignore[attr-defined]
            or payload["publish"]["published"] is True
            or payload["foundation_grants_publish"] is True
            or payload["publish"]["external_approval_granted_by_foundation"] is True
            or payload["publish"]["authorization"] != "NOT_AUTHORIZED"
            or mod.RefusalCode.HUMAN_GATE_NOT_GRANTED not in _codes(forged)  # type: ignore[attr-defined]
        ):
            _mark(found, "APPROVAL")

    approval = mod.ExternalHumanApproval(gate_id="gate-later", approver_ref="human:external")  # type: ignore[attr-defined]
    object.__setattr__(approval, "decision", "GRANTED")
    verified = mod.VerifyRecord(  # type: ignore[attr-defined]
        draft_id="local-draft-x",
        verdict=mod.VerificationVerdict.PASS,  # type: ignore[attr-defined]
        counts_as_pass=True,
        status="COMPLETE",
    )
    try:
        receipt, _refusals = mod.hold_publish(verified, approval)  # type: ignore[attr-defined]
    except Exception:
        _mark(found, "APPROVAL")
    else:
        body = receipt.to_dict()
        if (
            body["published"] is True
            or body["live"] is True
            or body["external_approval_granted_by_foundation"] is True
            or body["authorization"] != "NOT_AUTHORIZED"
        ):
            _mark(found, "APPROVAL")

    return found
