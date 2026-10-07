"""SPE-R9-E repair — runtime journey observation hooks (builder regression only).

These tests prove the hooks expose enough evidence for an INDEPENDENT verifier
and that no writer/runtime artefact can promote PRODUCT_MEDIA_V1 or OCR_PRODUCT.
They do NOT qualify the product.
"""

from __future__ import annotations

import copy
import json
import os
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from spe_runtime import journey_observation as jo
from spe_runtime.media_product import local_backend as media
from spe_runtime.ocr_product import local_backend as ocr

CANDIDATE = "a" * 40
OTHER = "b" * 40
ASR_PINS = media.JOURNEY_PINS
OCR_PINS = ocr.JOURNEY_PINS


def _asr_observation(**over: object) -> dict:
    env = {jo.CANDIDATE_ENV: CANDIDATE, jo.PROVISION_AUTH_ENV: "1"}
    obs = jo.JourneyObserver("ASR", env=env)
    obs.record("PROCESS_START", boot_id=obs.boot_id)
    obs.record("PACK_STATE", model_present=False, cli_present=False, build_src_present=False)
    obs.record("PROVISION_AUTHORIZATION", **jo.provision_authorization(env))
    obs.record(
        "INGRESS", kind="model", ok=True, source_host="huggingface.co", final_host="cdn-lfs.hf.co",
        bytes=ASR_PINS["model_bytes"], sha256=ASR_PINS["model_sha256"],
        expected_sha256=ASR_PINS["model_sha256"], digest_ok=True,
    )
    obs.record(
        "CLI_BUILD", result="OK", acquired=True, source_pin=media.SOURCE_PIN, source_host="github.com",
        sha256=ASR_PINS["cli_sha256"], bytes=ASR_PINS["cli_bytes"], rpath_clean=True,
    )
    obs.record("RUNTIME_READY", cli_sha256=ASR_PINS["cli_sha256"], model_sha256=ASR_PINS["model_sha256"])
    obs.record(
        "INFERENCE", engine="whisper-cli", mode="LOCAL_NEURAL", status="SPEECH", neural_session_ran=True,
        transcript_chars=5, transcript_sha256=jo.text_digest("అమ్మా"), error_code=None,
    )
    obs.record("EGRESS", user_media_egress=0)
    obs.record("TEMP_CLEANUP", scope="session", temp_files_remaining=0)
    obs.record("TEMP_CLEANUP", scope="upload", upload_removed=True)
    out = obs.export(product_stamp="NOT_PASS")
    out.update(over)
    return out


def _reentry(first: dict, **over: object) -> dict:
    obs = jo.JourneyObserver("ASR", env={jo.CANDIDATE_ENV: CANDIDATE})
    obs.record("PROCESS_START", boot_id=obs.boot_id)
    obs.record("PACK_STATE", model_present=True, cli_present=True, build_src_present=True)
    obs.record("RUNTIME_READY", cli_sha256=ASR_PINS["cli_sha256"], model_sha256=ASR_PINS["model_sha256"])
    out = obs.export(product_stamp="NOT_PASS")
    out.update(over)
    return out


BROWSER_OK = {"executed": True, "candidate_sha": CANDIDATE, "route_mounted": True, "inference_via_route": True, "recorded_by": "INDEPENDENT_VERIFIER"}


def _assess(obs: dict, *, product: str = "ASR", browser: dict | None = BROWSER_OK, reentry: dict | None | str = "auto") -> dict:
    pins = ASR_PINS if product == "ASR" else OCR_PINS
    if reentry == "auto":
        reentry = _reentry(obs)
    return jo.assess_observation(
        obs, product=product, expected_candidate_sha=CANDIDATE, pins=pins,
        browser_evidence=browser, reentry_observation=reentry,  # type: ignore[arg-type]
    )


def _mutate_event(obs: dict, phase: str, **changes: object) -> dict:
    out = copy.deepcopy(obs)
    for event in out["events"]:
        if event["phase"] == phase:
            event["data"].update(changes)
    return out


def _codes(result: dict) -> set[str]:
    return {f["code"] for f in result["findings"]}


# --- positive control: even a complete observation never promotes -------------------------

def test_complete_observation_still_never_promotes_asr() -> None:
    result = _assess(_asr_observation())
    assert result["all_observable_gates_observed"] is True, result["findings"]
    assert result["blocking"] is False
    assert result["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert result["verdict"] == "NOT_PASS"
    assert result["may_promote"] is False
    assert result["authority"] == "NONE_PRECHECK_ONLY"
    assert result["next"] == "INDEPENDENT_VERIFIER_REQUIRED"
    assert "PASS" not in json.dumps(result).replace("NOT_PASS", "")


def test_observation_export_shape_is_verifier_readable() -> None:
    obs = _asr_observation()
    assert obs["schema"] == jo.OBSERVATION_SCHEMA
    assert obs["may_promote"] is False
    assert obs["writer_role"] == "RUNTIME_OBSERVER"
    assert obs["browser_journey"] == "NOT_OBSERVED_BY_RUNTIME"
    assert obs["candidate_binding"] == "ENV_BOUND"
    phases = [e["phase"] for e in obs["events"]]
    assert phases[:6] == ["PROCESS_START", "PACK_STATE", "PROVISION_AUTHORIZATION", "INGRESS", "CLI_BUILD", "RUNTIME_READY"]
    # No raw transcript text is stored.
    assert "అమ్మా" not in json.dumps(obs, ensure_ascii=False)


# --- required negative tests ---------------------------------------------------------------

def test_preseeded_model_falsely_reported_as_fresh_provision() -> None:
    obs = _mutate_event(_asr_observation(), "PACK_STATE", model_present=True, cli_present=True)
    result = _assess(obs)
    assert result["gates"]["PACK_ABSENT_BEFORE_PROVISION"] == "CONTRADICTED"
    assert "PRESEEDED_REPORTED_AS_FRESH" in _codes(result)
    assert result["verdict"] == "NOT_PASS" and result["may_promote"] is False


def test_preseeded_pack_without_fresh_claim_is_missing_not_pass() -> None:
    obs = _asr_observation()
    obs["events"] = [e for e in obs["events"] if e["phase"] not in {"INGRESS", "CLI_BUILD", "PROVISION_AUTHORIZATION"}]
    obs = _mutate_event(obs, "PACK_STATE", model_present=True, cli_present=True)
    result = _assess(obs)
    assert result["gates"]["PACK_ABSENT_BEFORE_PROVISION"] == "MISSING"
    assert result["gates"]["MODEL_INGRESS"] == "MISSING"
    assert result["gates"]["CLI_BUILD"] == "MISSING"
    assert result["blocking"] is True


def test_digest_mismatch() -> None:
    obs = _mutate_event(_asr_observation(), "INGRESS", sha256="0" * 64, digest_ok=False)
    result = _assess(obs)
    assert result["gates"]["MODEL_INGRESS"] == "CONTRADICTED"
    assert "DIGEST_MISMATCH" in _codes(result)


def test_failed_cli_build() -> None:
    obs = _mutate_event(_asr_observation(), "CLI_BUILD", result="FAILED", error="PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED")
    result = _assess(obs)
    assert result["gates"]["CLI_BUILD"] == "CONTRADICTED"
    assert any(c.startswith("CLI_BUILD_FAILED") for c in _codes(result))


def test_inference_fallback_falsely_labeled_local_neural() -> None:
    obs = _mutate_event(_asr_observation(), "INFERENCE", mode="LOCAL_NEURAL", neural_session_ran=False)
    result = _assess(obs)
    assert result["gates"]["LOCAL_INFERENCE"] == "CONTRADICTED"
    assert "FALSE_LOCAL_NEURAL" in _codes(result)
    browser = _mutate_event(_asr_observation(), "INFERENCE", engine="web-speech")
    assert "INFERENCE_ENGINE_NOT_LOCAL_PINNED" in _codes(_assess(browser))


def test_neural_session_ran_false() -> None:
    obs = _mutate_event(_asr_observation(), "INFERENCE", mode="LOCAL_FALLBACK", neural_session_ran=False)
    result = _assess(obs)
    assert result["gates"]["LOCAL_INFERENCE"] == "CONTRADICTED"
    assert {"NEURAL_SESSION_NOT_RUN", "INFERENCE_NOT_LOCAL_NEURAL"} <= _codes(result)


def test_user_media_egress_nonzero() -> None:
    obs = _mutate_event(_asr_observation(), "EGRESS", user_media_egress=1)
    result = _assess(obs)
    assert result["gates"]["USER_MEDIA_EGRESS_ZERO"] == "CONTRADICTED"
    assert "USER_MEDIA_EGRESS_NONZERO" in _codes(result)


def test_temporary_media_remains() -> None:
    obs = _mutate_event(_asr_observation(), "TEMP_CLEANUP", temp_files_remaining=2)
    result = _assess(obs)
    assert result["gates"]["TEMP_CLEANUP"] == "CONTRADICTED"
    obs2 = _mutate_event(_asr_observation(), "TEMP_CLEANUP", upload_removed=False)
    assert _assess(obs2)["gates"]["TEMP_CLEANUP"] == "CONTRADICTED"


def test_browser_journey_not_executed() -> None:
    result = _assess(_asr_observation(), browser=None)
    assert result["gates"]["BROWSER_JOURNEY"] == "MISSING"
    assert "BROWSER_JOURNEY_NOT_EXECUTED" in _codes(result)
    writer_browser = dict(BROWSER_OK, recorded_by="RUNTIME_OBSERVER")
    assert _assess(_asr_observation(), browser=writer_browser)["gates"]["BROWSER_JOURNEY"] == "CONTRADICTED"


def test_stale_receipt_from_another_candidate() -> None:
    result = _assess(_asr_observation(candidate_sha=OTHER))
    assert result["gates"]["CANDIDATE_BINDING"] == "CONTRADICTED"
    assert "STALE_CANDIDATE" in _codes(result)
    unbound = _assess(_asr_observation(candidate_sha=None))
    assert unbound["gates"]["CANDIDATE_BINDING"] == "MISSING"
    stale_browser = dict(BROWSER_OK, candidate_sha=OTHER)
    assert _assess(_asr_observation(), browser=stale_browser)["gates"]["BROWSER_JOURNEY"] == "CONTRADICTED"


def test_writer_attempts_self_promotion() -> None:
    for over in (
        {"may_promote": True},
        {"product_stamp": {"PRODUCT_MEDIA_V1": "PASS"}},
        {"writer_role": "INDEPENDENT_VERIFIER"},
        {"verdict": "PASS"},
    ):
        result = _assess(_asr_observation(**over))
        assert result["gates"]["NO_WRITER_PROMOTION"] == "CONTRADICTED", over
        assert result["verdict"] == "NOT_PASS"
        assert result["may_promote"] is False
    obs = jo.JourneyObserver("ASR", env={})
    for key in ("may_promote", "verdict", "PRODUCT_MEDIA_V1", "OCR_PRODUCT", "qualified"):
        with pytest.raises(ValueError, match="WRITER_PROMOTION_FIELD_REFUSED"):
            obs.record("INFERENCE", **{key: True})


def test_restart_reentry_requires_new_boot_without_reprovision() -> None:
    first = _asr_observation()
    assert _assess(first, reentry=None)["gates"]["RESTART_REENTRY"] == "MISSING"
    same_boot = _reentry(first, boot_id=first["boot_id"])
    assert _assess(first, reentry=same_boot)["gates"]["RESTART_REENTRY"] == "CONTRADICTED"
    refetch = _reentry(first)
    refetch["events"].append({"seq": 99, "phase": "INGRESS", "t_ms": 0, "data": {"kind": "model", "ok": True}})
    assert _assess(first, reentry=refetch)["gates"]["RESTART_REENTRY"] == "CONTRADICTED"


def test_implicit_autofetch_is_not_explicit_authorization() -> None:
    obs = _mutate_event(_asr_observation(), "PROVISION_AUTHORIZATION", authorized=False, basis="IMPLICIT_ABSENT_PACK_AUTOFETCH")
    result = _assess(obs)
    assert result["gates"]["PROVISION_AUTHORIZED"] == "MISSING"
    assert jo.provision_authorization({})["authorized"] is False


# --- OCR equivalents -------------------------------------------------------------------

def _ocr_observation(**over: object) -> dict:
    env = {jo.CANDIDATE_ENV: CANDIDATE, jo.PROVISION_AUTH_ENV: "1"}
    obs = jo.JourneyObserver("OCR", env=env)
    obs.record("PROCESS_START", boot_id=obs.boot_id)
    obs.record("PACK_STATE", model_present=False, cli_present=False, cli_partial=False)
    obs.record("PROVISION_AUTHORIZATION", **jo.provision_authorization(env))
    obs.record("INGRESS", kind="traineddata", ok=True, source_host="raw.githubusercontent.com",
               bytes=OCR_PINS["model_bytes"], sha256=OCR_PINS["model_sha256"], expected_sha256=OCR_PINS["model_sha256"], digest_ok=True)
    obs.record("CLI_BUILD", result="OK", acquired=True, install="PINNED_BOTTLE_RELINK", source_hosts=["ghcr.io"],
               sha256=OCR_PINS["cli_sha256"], bytes=OCR_PINS["cli_bytes"])
    obs.record("RUNTIME_READY", cli_sha256=OCR_PINS["cli_sha256"], model_sha256=OCR_PINS["model_sha256"])
    obs.record("INFERENCE", engine="tesseract", mode="LOCAL_OCR", engine_ran=True, text_chars=24, text_sha256="x", error_code=None)
    obs.record("EGRESS", user_media_egress=0, hosts=[])
    obs.record("TEMP_CLEANUP", scope="session", temp_files_remaining=0)
    out = obs.export(product_stamp="HOLD")
    out.update(over)
    return out


def _ocr_reentry() -> dict:
    obs = jo.JourneyObserver("OCR", env={jo.CANDIDATE_ENV: CANDIDATE})
    obs.record("PACK_STATE", model_present=True, cli_present=True, cli_partial=False)
    obs.record("RUNTIME_READY", cli_sha256=OCR_PINS["cli_sha256"], model_sha256=OCR_PINS["model_sha256"])
    return obs.export(product_stamp="HOLD")


def test_ocr_complete_observation_stays_hold() -> None:
    result = _assess(_ocr_observation(), product="OCR", reentry=_ocr_reentry())
    assert result["all_observable_gates_observed"] is True, result["findings"]
    assert result["OCR_PRODUCT"] == "HOLD" and result["verdict"] == "HOLD"
    assert result["may_promote"] is False


@pytest.mark.parametrize(
    "mutation, gate",
    [
        (("INFERENCE", {"mode": "LOCAL_OCR", "engine_ran": False}), "LOCAL_INFERENCE"),
        (("INFERENCE", {"mode": "UNAVAILABLE"}), "LOCAL_INFERENCE"),
        (("EGRESS", {"user_media_egress": 3}), "USER_MEDIA_EGRESS_ZERO"),
        (("TEMP_CLEANUP", {"temp_files_remaining": 1}), "TEMP_CLEANUP"),
        (("INGRESS", {"sha256": "f" * 64, "digest_ok": False}), "MODEL_INGRESS"),
        (("CLI_BUILD", {"result": "FAILED"}), "CLI_BUILD"),
        (("PACK_STATE", {"model_present": True, "cli_present": True}), "PACK_ABSENT_BEFORE_PROVISION"),
    ],
)
def test_ocr_negative_gates(mutation, gate) -> None:
    phase, changes = mutation
    result = _assess(_mutate_event(_ocr_observation(), phase, **changes), product="OCR", reentry=_ocr_reentry())
    assert result["gates"][gate] == "CONTRADICTED", result["findings"]
    assert result["verdict"] == "HOLD"


def test_ocr_writer_promotion_refused() -> None:
    result = _assess(_ocr_observation(product_stamp={"OCR_PRODUCT": "PASS"}), product="OCR", reentry=_ocr_reentry())
    assert result["gates"]["NO_WRITER_PROMOTION"] == "CONTRADICTED"
    assert result["OCR_PRODUCT"] == "HOLD"


# --- wiring: owners record real events; routes expose /journey --------------------------

def test_media_discover_records_absent_pack_ingress_build_and_ready(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo = Path(__file__).resolve().parents[2]
    pack = tmp_path / "media-pack"
    pack.mkdir()
    (pack / "PACK_MANIFEST.json").write_bytes((repo / "media-pack" / "PACK_MANIFEST.json").read_bytes())
    monkeypatch.setattr(media, "pack_root", lambda: pack)
    monkeypatch.setattr(media, "_host_arch", lambda: "arm64")
    monkeypatch.setenv(jo.PROVISION_AUTH_ENV, "1")

    def fake_model(model_path: Path, manifest: dict) -> str:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        with model_path.open("wb") as fh:
            fh.truncate(media.PINNED_TE_MODEL_BYTES)
        return "https://cdn-lfs.example-host.org/ggml-te-small.bin"

    def fake_cli(cli_path: Path, manifest: dict) -> None:
        with cli_path.open("wb") as fh:
            fh.truncate(media.PINNED_CLI_BYTES)

    def fake_verify(path: Path, *, expected_sha: str, expected_bytes: int, kind: str, architectures: list[str]) -> str:
        return expected_sha

    monkeypatch.setattr(media, "_acquire_absent_model", fake_model)
    monkeypatch.setattr(media, "_acquire_absent_cli", fake_cli)
    monkeypatch.setattr(media, "_verify_packed_file", fake_verify)
    monkeypatch.setattr(media, "_reject_external_linkage", lambda path: None)
    media.JOURNEY_OBSERVER.reset_for_tests()
    media.discover_qualified_assets()
    exported = media.JOURNEY_OBSERVER.export(product_stamp="NOT_PASS")
    phases = [e["phase"] for e in exported["events"]]
    assert phases == ["PACK_STATE", "PROVISION_AUTHORIZATION", "INGRESS", "CLI_BUILD", "RUNTIME_READY"]
    pack_state = exported["events"][0]["data"]
    assert pack_state == {"model_present": False, "cli_present": False, "build_src_present": False}
    ingress = exported["events"][2]["data"]
    assert ingress["ok"] is True and ingress["bytes"] == media.PINNED_TE_MODEL_BYTES
    assert ingress["source_host"] and ingress["final_host"] == "cdn-lfs.example-host.org"
    assert exported["events"][3]["data"]["result"] == "OK"
    # Second discover (pack now present) records a pre-seeded state, no ingress/build.
    media.discover_qualified_assets()
    tail = [e["phase"] for e in media.JOURNEY_OBSERVER.events()][5:]
    assert tail == ["PACK_STATE", "RUNTIME_READY"]
    media.JOURNEY_OBSERVER.reset_for_tests()


def test_media_discover_records_failed_cli_build(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    repo = Path(__file__).resolve().parents[2]
    pack = tmp_path / "media-pack"
    (pack / "models").mkdir(parents=True)
    (pack / "PACK_MANIFEST.json").write_bytes((repo / "media-pack" / "PACK_MANIFEST.json").read_bytes())
    with (pack / "models" / "ggml-te-small.bin").open("wb") as fh:
        fh.truncate(media.PINNED_TE_MODEL_BYTES)
    monkeypatch.setattr(media, "pack_root", lambda: pack)
    monkeypatch.setattr(media, "_host_arch", lambda: "arm64")
    monkeypatch.setattr(media, "_verify_packed_file", lambda path, **kw: kw["expected_sha"])

    def broken_cli(cli_path: Path, manifest: dict) -> None:
        raise media.IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED")

    monkeypatch.setattr(media, "_acquire_absent_cli", broken_cli)
    media.JOURNEY_OBSERVER.reset_for_tests()
    with pytest.raises(media.IntegrityError):
        media.discover_qualified_assets()
    events = media.JOURNEY_OBSERVER.events()
    build = [e for e in events if e["phase"] == "CLI_BUILD"]
    assert build and build[0]["data"]["result"] == "FAILED"
    media.JOURNEY_OBSERVER.reset_for_tests()


def _serve(handler_cls):
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


@pytest.mark.parametrize("module_name, stamp_key, hold", [
    ("spe_runtime.media_product.route_host", "PRODUCT_MEDIA_V1", "NOT_PASS"),
    ("spe_runtime.ocr_product.route_host", "OCR_PRODUCT", "HOLD"),
])
def test_route_hosts_expose_journey_hook_without_promotion(module_name: str, stamp_key: str, hold: str, monkeypatch: pytest.MonkeyPatch) -> None:
    import importlib

    monkeypatch.setenv(jo.CANDIDATE_ENV, CANDIDATE)
    module = importlib.import_module(module_name)
    server = _serve(module.Handler)
    try:
        port = server.server_address[1]
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/journey", timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    finally:
        server.shutdown()
        server.server_close()
    assert body["schema"] == jo.OBSERVATION_SCHEMA
    assert body["may_promote"] is False
    assert body["product_stamp"] == {stamp_key: hold}
    assert body["candidate_sha"] == CANDIDATE
    assert body["browser_journey"] == "NOT_OBSERVED_BY_RUNTIME"
