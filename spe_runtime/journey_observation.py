"""Runtime journey observation hooks for the local ASR / OCR product paths.

SPE-R9-E builder repair. Instrumentation only — NOT a qualification authority.

The canonical owners (spe_runtime.media_product / spe_runtime.ocr_product)
record what the runtime actually did, in order, so that an INDEPENDENT
verifier can inspect one fresh journey end to end:

    PACK_STATE (absent?) -> PROVISION_AUTHORIZATION -> INGRESS (source host,
    bytes, SHA-256) -> CLI_BUILD / runtime install -> RUNTIME_READY ->
    INFERENCE (LOCAL_NEURAL / LOCAL_OCR) -> EGRESS (user media) ->
    TEMP_CLEANUP -> PROCESS_START of a later boot (restart / re-entry)

Rules:
* The observation is a writer/runtime artefact. ``may_promote`` is always
  False and the writer role is RUNTIME_OBSERVER. Events may not carry
  verdict / promotion fields.
* The runtime cannot observe the browser journey. It reports
  ``NOT_OBSERVED_BY_RUNTIME``; only verifier-supplied browser evidence can
  fill that gate.
* ``assess_observation`` is a pre-check that surfaces missing or
  contradicted evidence for the verifier. Its verdict is the product's hold
  value (PRODUCT_MEDIA_V1=NOT_PASS, OCR_PRODUCT=HOLD) in every case,
  including when every observable gate is present.
* No user media bytes and no transcript / OCR text are stored; only
  digests, lengths, counters, and hosts.
"""

from __future__ import annotations

import hashlib
import os
import re
import threading
import time
import uuid
from typing import Mapping

OBSERVATION_SCHEMA = "spe.runtime_journey_observation.v1"
ASSESSMENT_SCHEMA = "spe.runtime_journey_assessment.v1"
CANDIDATE_ENV = "SPE_JOURNEY_CANDIDATE_SHA"
PROVISION_AUTH_ENV = "SPE_JOURNEY_PROVISION_AUTHORIZED"
WRITER_ROLE = "RUNTIME_OBSERVER"
BROWSER_NOT_OBSERVED = "NOT_OBSERVED_BY_RUNTIME"

PRODUCTS: dict[str, dict[str, str]] = {
    "ASR": {"stamp_key": "PRODUCT_MEDIA_V1", "hold_value": "NOT_PASS", "engine": "whisper-cli", "mode": "LOCAL_NEURAL"},
    "OCR": {"stamp_key": "OCR_PRODUCT", "hold_value": "HOLD", "engine": "tesseract", "mode": "LOCAL_OCR"},
}

PHASES = (
    "PROCESS_START",
    "PACK_STATE",
    "PROVISION_AUTHORIZATION",
    "INGRESS",
    "CLI_BUILD",
    "RUNTIME_READY",
    "INFERENCE",
    "EGRESS",
    "TEMP_CLEANUP",
)

# Keys a writer/runtime may never place in an observation event.
FORBIDDEN_EVENT_KEYS = frozenset(
    {
        "may_promote",
        "verdict",
        "qualified",
        "qualification",
        "pass",
        "product_media_v1",
        "ocr_product",
        "promote",
        "promoted",
    }
)

_HEAD_EVENTS = 128
_TAIL_EVENTS = 384
_SHA1_RE = re.compile(r"^[0-9a-f]{40}$")


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _scalar_ok(value: object) -> bool:
    if value is None or isinstance(value, (bool, int, float, str)):
        return True
    if isinstance(value, (list, tuple)):
        return all(v is None or isinstance(v, (bool, int, float, str)) for v in value)
    return False


def host_of(url: str) -> str:
    rest = str(url).split("://", 1)[-1]
    return rest.split("/", 1)[0].split("@")[-1].split(":")[0].lower()


def provision_authorization(env: Mapping[str, str] | None = None) -> dict[str, object]:
    """Explicit operator authorization signal, or the implicit absent-pack autofetch."""
    source = os.environ if env is None else env
    if str(source.get(PROVISION_AUTH_ENV, "")).strip() == "1":
        return {"authorized": True, "basis": f"ENV:{PROVISION_AUTH_ENV}"}
    return {"authorized": False, "basis": "IMPLICIT_ABSENT_PACK_AUTOFETCH"}


class JourneyObserver:
    """Append-only, thread-safe journey event log for one runtime process."""

    def __init__(self, product: str, *, env: Mapping[str, str] | None = None) -> None:
        if product not in PRODUCTS:
            raise ValueError(f"UNKNOWN_PRODUCT:{product}")
        self.product = product
        self._env = env
        self._lock = threading.Lock()
        self._head: list[dict[str, object]] = []
        self._tail: list[dict[str, object]] = []
        self._dropped = 0
        self._seq = 0
        self.boot_id = uuid.uuid4().hex

    def _candidate(self) -> str | None:
        source = os.environ if self._env is None else self._env
        value = str(source.get(CANDIDATE_ENV, "")).strip().lower()
        return value if _SHA1_RE.match(value) else None

    def record(self, phase: str, **data: object) -> None:
        if phase not in PHASES:
            raise ValueError(f"UNKNOWN_PHASE:{phase}")
        for key, value in data.items():
            if key.lower() in FORBIDDEN_EVENT_KEYS:
                raise ValueError(f"WRITER_PROMOTION_FIELD_REFUSED:{key}")
            if not _scalar_ok(value):
                raise ValueError(f"NON_SCALAR_EVENT_FIELD:{key}")
        with self._lock:
            self._seq += 1
            event = {
                "seq": self._seq,
                "phase": phase,
                "t_ms": int(time.monotonic() * 1000),
                "data": {k: (list(v) if isinstance(v, tuple) else v) for k, v in data.items()},
            }
            if len(self._head) < _HEAD_EVENTS:
                self._head.append(event)
            else:
                self._tail.append(event)
                if len(self._tail) > _TAIL_EVENTS:
                    self._tail.pop(0)
                    self._dropped += 1

    def events(self) -> list[dict[str, object]]:
        with self._lock:
            return [dict(e) for e in (*self._head, *self._tail)]

    def export(self, *, product_stamp: str) -> dict[str, object]:
        spec = PRODUCTS[self.product]
        candidate = self._candidate()
        return {
            "schema": OBSERVATION_SCHEMA,
            "product": self.product,
            "boot_id": self.boot_id,
            "pid": os.getpid(),
            "candidate_sha": candidate,
            "candidate_binding": "ENV_BOUND" if candidate else "UNBOUND",
            "writer_role": WRITER_ROLE,
            "may_promote": False,
            "product_stamp": {spec["stamp_key"]: product_stamp},
            "browser_journey": BROWSER_NOT_OBSERVED,
            "events_dropped": self._dropped,
            "events": self.events(),
        }

    def reset_for_tests(self) -> None:
        with self._lock:
            self._head.clear()
            self._tail.clear()
            self._dropped = 0
            self._seq = 0
            self.boot_id = uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Pre-check for the independent verifier. Never a pass.
# ---------------------------------------------------------------------------

OBSERVED = "OBSERVED"
MISSING = "MISSING"
CONTRADICTED = "CONTRADICTED"


def _phase(events: list[dict[str, object]], name: str) -> list[dict[str, object]]:
    return [e for e in events if e.get("phase") == name]


def _data(event: dict[str, object]) -> dict[str, object]:
    data = event.get("data")
    return data if isinstance(data, dict) else {}


def assess_observation(
    observation: Mapping[str, object],
    *,
    product: str,
    expected_candidate_sha: str,
    pins: Mapping[str, object],
    browser_evidence: Mapping[str, object] | None = None,
    reentry_observation: Mapping[str, object] | None = None,
) -> dict[str, object]:
    """Surface missing / contradicted journey evidence. Verdict is never PASS."""
    if product not in PRODUCTS:
        raise ValueError(f"UNKNOWN_PRODUCT:{product}")
    spec = PRODUCTS[product]
    gates: dict[str, str] = {}
    findings: list[dict[str, str]] = []

    def gate(name: str, state: str, code: str | None = None) -> None:
        previous = gates.get(name)
        order = {OBSERVED: 0, MISSING: 1, CONTRADICTED: 2}
        if previous is None or order[state] > order[previous]:
            gates[name] = state
        if code:
            findings.append({"gate": name, "state": state, "code": code})

    raw_events = observation.get("events")
    events = [e for e in raw_events if isinstance(e, dict)] if isinstance(raw_events, list) else []

    # Schema / product identity.
    if observation.get("schema") != OBSERVATION_SCHEMA or observation.get("product") != product:
        gate("OBSERVATION_IDENTITY", CONTRADICTED, "SCHEMA_OR_PRODUCT_MISMATCH")
    else:
        gate("OBSERVATION_IDENTITY", OBSERVED)

    # Candidate binding (stale receipt from another candidate).
    expected = str(expected_candidate_sha or "").strip().lower()
    got = observation.get("candidate_sha")
    if not _SHA1_RE.match(expected):
        gate("CANDIDATE_BINDING", MISSING, "VERIFIER_EXPECTED_CANDIDATE_INVALID")
    elif not isinstance(got, str) or not got:
        gate("CANDIDATE_BINDING", MISSING, "OBSERVATION_UNBOUND")
    elif got.lower() != expected:
        gate("CANDIDATE_BINDING", CONTRADICTED, "STALE_CANDIDATE")
    else:
        gate("CANDIDATE_BINDING", OBSERVED)

    # Writer self-promotion.
    stamp = observation.get("product_stamp")
    stamp_value = stamp.get(spec["stamp_key"]) if isinstance(stamp, dict) else None
    promo = False
    if observation.get("may_promote") is not False:
        promo = True
    if observation.get("writer_role") != WRITER_ROLE:
        promo = True
    if stamp_value != spec["hold_value"]:
        promo = True
    for event in events:
        for key, value in _data(event).items():
            if key.lower() in FORBIDDEN_EVENT_KEYS or value == "PASS":
                promo = True
    for key in observation.keys():
        if str(key).lower() in FORBIDDEN_EVENT_KEYS - {"may_promote"}:
            promo = True
    gate("NO_WRITER_PROMOTION", CONTRADICTED if promo else OBSERVED, "WRITER_SELF_PROMOTION" if promo else None)

    pack_states = _phase(events, "PACK_STATE")
    ingress = _phase(events, "INGRESS")
    builds = _phase(events, "CLI_BUILD")
    auths = _phase(events, "PROVISION_AUTHORIZATION")
    model_kind = "model" if product == "ASR" else "traineddata"

    # Absence before provisioning; pre-seeded pack must not be reported as fresh.
    first_pack = _data(pack_states[0]) if pack_states else None
    fresh_ingress = [e for e in ingress if _data(e).get("kind") == model_kind and _data(e).get("ok") is True]
    fresh_build = [e for e in builds if _data(e).get("acquired") is True]
    if first_pack is None:
        gate("PACK_ABSENT_BEFORE_PROVISION", MISSING, "PACK_STATE_NOT_OBSERVED")
    else:
        model_present = first_pack.get("model_present") is not False
        cli_present = first_pack.get("cli_present") is not False
        src_present = first_pack.get("build_src_present") is True
        first_seq = int(pack_states[0].get("seq") or 0)
        if any(int(e.get("seq") or 0) < first_seq for e in (*ingress, *builds)):
            gate("PACK_ABSENT_BEFORE_PROVISION", CONTRADICTED, "PROVISION_BEFORE_ABSENCE_OBSERVED")
        if (model_present and fresh_ingress) or (cli_present and fresh_build):
            gate("PACK_ABSENT_BEFORE_PROVISION", CONTRADICTED, "PRESEEDED_REPORTED_AS_FRESH")
        if any(_data(e).get("fresh") is True for e in events) and (model_present or cli_present):
            gate("PACK_ABSENT_BEFORE_PROVISION", CONTRADICTED, "PRESEEDED_REPORTED_AS_FRESH")
        if model_present or cli_present or src_present:
            gate("PACK_ABSENT_BEFORE_PROVISION", MISSING, "PACK_PRESEEDED")
        else:
            gate("PACK_ABSENT_BEFORE_PROVISION", OBSERVED)

    # Explicit provisioning authorization, before any ingress.
    explicit = [e for e in auths if _data(e).get("authorized") is True]
    if not explicit:
        gate("PROVISION_AUTHORIZED", MISSING, "PROVISIONING_NOT_EXPLICITLY_AUTHORIZED")
    else:
        auth_seq = int(explicit[0].get("seq") or 0)
        if any(int(e.get("seq") or 0) < auth_seq for e in (*ingress, *builds)):
            gate("PROVISION_AUTHORIZED", CONTRADICTED, "INGRESS_BEFORE_AUTHORIZATION")
        else:
            gate("PROVISION_AUTHORIZED", OBSERVED)

    # Model / traineddata ingress: host, bytes, digest.
    model_events = [e for e in ingress if _data(e).get("kind") == model_kind]
    if not model_events:
        gate("MODEL_INGRESS", MISSING, "MODEL_INGRESS_NOT_OBSERVED")
    for event in model_events:
        d = _data(event)
        if d.get("ok") is not True:
            gate("MODEL_INGRESS", CONTRADICTED, f"INGRESS_FAILED:{d.get('error') or 'UNKNOWN'}")
            continue
        if d.get("sha256") != pins.get("model_sha256") or d.get("digest_ok") is not True:
            gate("MODEL_INGRESS", CONTRADICTED, "DIGEST_MISMATCH")
        elif pins.get("model_bytes") is not None and d.get("bytes") != pins.get("model_bytes"):
            gate("MODEL_INGRESS", CONTRADICTED, "SIZE_MISMATCH")
        elif not d.get("source_host"):
            gate("MODEL_INGRESS", MISSING, "SOURCE_HOST_NOT_RECORDED")
        else:
            gate("MODEL_INGRESS", OBSERVED)

    # CLI build (ASR) / pinned runtime install (OCR).
    if not builds:
        gate("CLI_BUILD", MISSING, "CLI_BUILD_NOT_OBSERVED")
    for event in builds:
        d = _data(event)
        if d.get("result") != "OK":
            gate("CLI_BUILD", CONTRADICTED, f"CLI_BUILD_FAILED:{d.get('error') or d.get('result')}")
        elif d.get("sha256") != pins.get("cli_sha256"):
            gate("CLI_BUILD", CONTRADICTED, "CLI_DIGEST_MISMATCH")
        elif pins.get("cli_bytes") is not None and d.get("bytes") != pins.get("cli_bytes"):
            gate("CLI_BUILD", CONTRADICTED, "CLI_SIZE_MISMATCH")
        elif product == "ASR" and d.get("rpath_clean") is not True:
            gate("CLI_BUILD", CONTRADICTED, "CLI_RPATH_NOT_CLEAN")
        else:
            gate("CLI_BUILD", OBSERVED)

    # Runtime ready on pinned digests.
    ready = _phase(events, "RUNTIME_READY")
    if not ready:
        gate("RUNTIME_READY", MISSING, "RUNTIME_READY_NOT_OBSERVED")
    for event in ready:
        d = _data(event)
        if d.get("cli_sha256") != pins.get("cli_sha256") or d.get("model_sha256") != pins.get("model_sha256"):
            gate("RUNTIME_READY", CONTRADICTED, "RUNTIME_DIGEST_MISMATCH")
        else:
            gate("RUNTIME_READY", OBSERVED)

    # Real local inference.
    inference = _phase(events, "INFERENCE")
    if not inference:
        gate("LOCAL_INFERENCE", MISSING, "INFERENCE_NOT_OBSERVED")
    else:
        d = _data(inference[-1])
        engine = str(d.get("engine") or "").lower()
        if any(word in engine for word in ("browser", "web-speech", "webspeech", "cloud", "remote")) or engine != spec["engine"]:
            gate("LOCAL_INFERENCE", CONTRADICTED, "INFERENCE_ENGINE_NOT_LOCAL_PINNED")
        if product == "ASR":
            if d.get("mode") == "LOCAL_NEURAL" and d.get("neural_session_ran") is not True:
                gate("LOCAL_INFERENCE", CONTRADICTED, "FALSE_LOCAL_NEURAL")
            if d.get("neural_session_ran") is not True:
                gate("LOCAL_INFERENCE", CONTRADICTED, "NEURAL_SESSION_NOT_RUN")
            if d.get("mode") != "LOCAL_NEURAL":
                gate("LOCAL_INFERENCE", CONTRADICTED, "INFERENCE_NOT_LOCAL_NEURAL")
            if d.get("status") != "SPEECH" or not int(d.get("transcript_chars") or 0):
                gate("LOCAL_INFERENCE", MISSING, "NO_TRANSCRIPT")
        else:
            if d.get("mode") == "LOCAL_OCR" and d.get("engine_ran") is not True:
                gate("LOCAL_INFERENCE", CONTRADICTED, "FALSE_LOCAL_OCR")
            if d.get("mode") != "LOCAL_OCR":
                gate("LOCAL_INFERENCE", CONTRADICTED, "INFERENCE_NOT_LOCAL_OCR")
            if not int(d.get("text_chars") or 0):
                gate("LOCAL_INFERENCE", MISSING, "NO_OCR_TEXT")
        gate("LOCAL_INFERENCE", OBSERVED)

    # User media egress.
    egress = _phase(events, "EGRESS")
    if not egress:
        gate("USER_MEDIA_EGRESS_ZERO", MISSING, "EGRESS_NOT_OBSERVED")
    for event in egress:
        count = _data(event).get("user_media_egress")
        if not isinstance(count, int) or count != 0:
            gate("USER_MEDIA_EGRESS_ZERO", CONTRADICTED, "USER_MEDIA_EGRESS_NONZERO")
        else:
            gate("USER_MEDIA_EGRESS_ZERO", OBSERVED)

    # Temporary media cleanup.
    cleanup = _phase(events, "TEMP_CLEANUP")
    if not cleanup:
        gate("TEMP_CLEANUP", MISSING, "CLEANUP_NOT_OBSERVED")
    for event in cleanup:
        d = _data(event)
        remaining = d.get("temp_files_remaining", 0)
        if (not isinstance(remaining, int) or remaining != 0) or d.get("upload_removed") is False:
            gate("TEMP_CLEANUP", CONTRADICTED, "TEMP_MEDIA_REMAINS")
        else:
            gate("TEMP_CLEANUP", OBSERVED)

    # Browser journey: verifier evidence only.
    if not isinstance(browser_evidence, Mapping) or browser_evidence.get("executed") is not True:
        gate("BROWSER_JOURNEY", MISSING, "BROWSER_JOURNEY_NOT_EXECUTED")
    elif str(browser_evidence.get("candidate_sha") or "").lower() != expected:
        gate("BROWSER_JOURNEY", CONTRADICTED, "BROWSER_EVIDENCE_STALE_CANDIDATE")
    elif browser_evidence.get("recorded_by") == WRITER_ROLE:
        gate("BROWSER_JOURNEY", CONTRADICTED, "BROWSER_EVIDENCE_FROM_WRITER")
    elif browser_evidence.get("route_mounted") is not True or browser_evidence.get("inference_via_route") is not True:
        gate("BROWSER_JOURNEY", MISSING, "BROWSER_ROUTE_JOURNEY_INCOMPLETE")
    else:
        gate("BROWSER_JOURNEY", OBSERVED)

    # Restart / re-entry: a later boot that reuses the verified pack.
    if not isinstance(reentry_observation, Mapping):
        gate("RESTART_REENTRY", MISSING, "REENTRY_NOT_OBSERVED")
    else:
        r_events = reentry_observation.get("events")
        r_events = [e for e in r_events if isinstance(e, dict)] if isinstance(r_events, list) else []
        r_pack = _phase(r_events, "PACK_STATE")
        r_fetch = [e for e in (*_phase(r_events, "INGRESS"), *_phase(r_events, "CLI_BUILD"))]
        r_ready = _phase(r_events, "RUNTIME_READY")
        if reentry_observation.get("boot_id") == observation.get("boot_id"):
            gate("RESTART_REENTRY", CONTRADICTED, "SAME_BOOT_NOT_A_RESTART")
        elif str(reentry_observation.get("candidate_sha") or "").lower() != expected:
            gate("RESTART_REENTRY", CONTRADICTED, "REENTRY_STALE_CANDIDATE")
        elif r_fetch:
            gate("RESTART_REENTRY", CONTRADICTED, "REENTRY_REPROVISIONED")
        elif not r_pack or _data(r_pack[0]).get("model_present") is not True or _data(r_pack[0]).get("cli_present") is not True:
            gate("RESTART_REENTRY", MISSING, "REENTRY_PACK_STATE_NOT_OBSERVED")
        elif not r_ready:
            gate("RESTART_REENTRY", MISSING, "REENTRY_RUNTIME_NOT_READY")
        else:
            gate("RESTART_REENTRY", OBSERVED)

    blocking = any(state != OBSERVED for state in gates.values())
    return {
        "schema": ASSESSMENT_SCHEMA,
        "product": product,
        "expected_candidate_sha": expected or None,
        "gates": gates,
        "findings": findings,
        "all_observable_gates_observed": not blocking,
        "blocking": blocking,
        spec["stamp_key"]: spec["hold_value"],
        "verdict": spec["hold_value"],
        "may_promote": False,
        "authority": "NONE_PRECHECK_ONLY",
        "next": "INDEPENDENT_VERIFIER_REQUIRED",
    }
