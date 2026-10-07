"""SPE-R9-E authority separation — the ASR runtime is an evidence WRITER.

PRODUCT_MEDIA_V1 can never become PASS from runtime/writer evidence. A complete
runtime journey reports RUNTIME_JOURNEY=COMPLETE and
REMAINING_GAP=INDEPENDENT_VERIFICATION_REQUIRED. Builder regression only.
"""

from __future__ import annotations

import io
import json
import threading
import urllib.request
from contextlib import redirect_stderr
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from spe_runtime import journey_observation as jo
from spe_runtime.media_product import local_backend as media
from spe_runtime.media_product import route_host

IVR = "INDEPENDENT_VERIFICATION_REQUIRED"


def _assets(*, fresh: bool = True) -> media.QualifiedAssets:
    return media.QualifiedAssets(
        cli_path=Path("/nonexistent/whisper-cli"),
        cli_sha256=media.PINNED_CLI_SHA256,
        model_path=Path("/nonexistent/model.bin"),
        model_sha256=media.PINNED_TE_MODEL_SHA256,
        raw_download=fresh,
        cli_built=fresh,
        absence_before_fetch=fresh,
        model_bytes=media.PINNED_TE_MODEL_BYTES if fresh else 0,
        cli_bytes=media.PINNED_CLI_BYTES if fresh else 0,
        cli_rpath_clean=fresh,
        cli_spe_g12=not fresh,
    )


def _speech(*, egress: int = 0, neural: bool = True, mode: str = "LOCAL_NEURAL") -> media.LocalTranscript:
    return media.LocalTranscript(
        status="SPEECH", text="అమ్మా", execution="LOCAL_CPU", egress_attempts=egress,
        sandbox_network="DENY", timestamp_state=media.TIMESTAMP_STATE, raw_audio_retained=False,
        audio_sha256="0" * 64, media_kind="audio", pcm_released=True, mode=mode,
        neural_session_ran=neural, user_transcript_promoted=True,
    )


@pytest.fixture(autouse=True)
def _clean() -> None:
    media.reset_recorded_journey_for_tests()
    yield
    media.reset_recorded_journey_for_tests()


def _gates(journey=None) -> dict:
    return media.product_gates(local_file_transcription="LOCAL_NEURAL", raw_media_egress=0, journey=journey)


# 1 / 3 / 10
def test_complete_runtime_journey_records_evidence_but_never_passes() -> None:
    verdict, gap, writer_promoted = media.commit_product_journey(_assets(), _speech())
    assert verdict == "NOT_PASS"
    assert gap == IVR
    assert writer_promoted is False
    proof = media.recorded_journey()
    assert proof is not None, "complete runtime evidence must still be recorded"
    assert proof["absence_before_fetch"] is True
    assert proof["local_neural"] is True
    assert proof["user_audio_egress"] == 0
    assert proof["model_ingress"] == {"sha256": media.PINNED_TE_MODEL_SHA256, "bytes": media.PINNED_TE_MODEL_BYTES}
    assert media.journey_gap(proof) == "NONE"
    gates = _gates(proof)
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert gates["RUNTIME_JOURNEY"] == "COMPLETE"
    assert gates["REMAINING_GAP"] == IVR
    # 10: runtime-complete is distinguishable from a qualification pass.
    assert gates["REMAINING_GAP"] != "NONE"
    assert "PASS" not in json.dumps(gates).replace("NOT_PASS", "")


# 2
def test_complete_runtime_journey_cannot_return_may_promote_true() -> None:
    media.commit_product_journey(_assets(), _speech())
    gates = _gates(media.recorded_journey())
    for key, value in gates.items():
        if "promot" in key.lower():
            assert value is False
    exported = media.JOURNEY_OBSERVER.export(product_stamp=str(gates["PRODUCT_MEDIA_V1"]))
    assert exported["may_promote"] is False
    assert exported["product_stamp"] == {"PRODUCT_MEDIA_V1": "NOT_PASS"}


# 4
@pytest.mark.parametrize(
    "assets, result, expected",
    [
        (_assets(fresh=False), _speech(), {"ABSENCE_BEFORE_FETCH", "MODEL_INGRESS", "CLI_BUILD"}),
        (_assets(), _speech(neural=False), {"LOCAL_NEURAL"}),
        (_assets(), _speech(mode="LOCAL_FALLBACK"), {"LOCAL_NEURAL"}),
        (_assets(), _speech(egress=1), {"USER_AUDIO_EGRESS"}),
    ],
)
def test_incomplete_journey_stays_not_pass_with_concrete_gap(assets, result, expected) -> None:
    verdict, gap, writer_promoted = media.commit_product_journey(assets, result)
    assert verdict == "NOT_PASS" and writer_promoted is False
    assert gap == "JOURNEY_NOT_RECORDED"  # nothing complete was ever recorded
    assert media.recorded_journey() is None
    proof_gap = media.journey_gap({
        "absence_before_fetch": bool(assets.absence_before_fetch and assets.raw_download and assets.cli_built),
        "model_ingress": {"sha256": assets.model_sha256, "bytes": assets.model_bytes} if assets.raw_download else None,
        "cli_build": {"sha256": assets.cli_sha256, "bytes": assets.cli_bytes, "rpath_clean": assets.cli_rpath_clean, "spe_g12": assets.cli_spe_g12} if assets.cli_built else None,
        "local_neural": bool(result.mode == "LOCAL_NEURAL" and result.neural_session_ran and result.status == "SPEECH"),
        "user_audio_egress": result.egress_attempts,
    })
    assert expected <= set(proof_gap.split(","))
    gates = _gates(None)
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert gates["RUNTIME_JOURNEY"] == "INCOMPLETE"
    assert gates["REMAINING_GAP"] == "JOURNEY_NOT_RECORDED"


# 5
def test_previously_recorded_complete_journey_cannot_promote_later_call() -> None:
    media.commit_product_journey(_assets(), _speech())
    verdict, gap, writer_promoted = media.commit_product_journey(_assets(fresh=False), _speech())
    assert verdict == "NOT_PASS"
    assert gap == IVR
    assert writer_promoted is False


# 6
@pytest.mark.parametrize("journey", ["MOUNTED", {"mounted": True}, {"UI_MOUNTED": "YES"}, {}, None])
def test_mount_string_cannot_promote(journey) -> None:
    gates = _gates(journey)
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert gates["RUNTIME_JOURNEY"] == "INCOMPLETE"
    assert gates["REMAINING_GAP"] not in {"NONE", IVR}


# 7
def test_route_host_cannot_promote_health_journey_or_log(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeSession:
        temp_files_remaining = 0

        def transcribe_path(self, path):
            return _speech()

        def close(self):
            return None

    monkeypatch.setattr(route_host, "discover_qualified_assets", lambda: _assets())
    monkeypatch.setattr(route_host.LocalMediaSession, "open", classmethod(lambda cls, assets: FakeSession()))
    err = io.StringIO()
    with redirect_stderr(err):
        payload = route_host._run_job(route_host.Job(), Path("/nonexistent/upload.wav"))
    log = err.getvalue()
    assert payload["mode"] == "LOCAL_NEURAL"
    assert "PRODUCT_MEDIA_V1 PASS" not in log
    assert "RUNTIME_JOURNEY COMPLETE PRODUCT_MEDIA_V1 NOT_PASS remainingGap=INDEPENDENT_VERIFICATION_REQUIRED writerPromoted=false" in log

    server = ThreadingHTTPServer(("127.0.0.1", 0), route_host.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        port = server.server_address[1]
        health = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=10).read())
        journey = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/journey", timeout=10).read())
    finally:
        server.shutdown()
        server.server_close()
    assert health["productMediaV1"] == "NOT_PASS"
    assert health["remainingGap"] == IVR
    assert health["runtimeJourney"] == "COMPLETE"
    assert journey["product_stamp"] == {"PRODUCT_MEDIA_V1": "NOT_PASS"}
    assert journey["may_promote"] is False
    media.JOURNEY_OBSERVER.reset_for_tests()


# 8 (source-level guard; runtime UI guard is apps/web/scripts/test-r9e-media-authority.mjs)
def test_browser_ui_source_cannot_accept_pass_claim() -> None:
    repo = Path(__file__).resolve().parents[2]
    route = (repo / "apps/web/src/media/MediaRoute.tsx").read_text(encoding="utf-8")
    contract = (repo / "apps/web/src/media/mount-contract.ts").read_text(encoding="utf-8")
    assert '"PASS"' not in route
    assert "export function readRouteClaim" in route
    assert 'productMediaV1: "NOT_PASS"' in contract


# 9
def test_injected_product_stamp_pass_is_flagged_by_assessor() -> None:
    obs = media.JOURNEY_OBSERVER.export(product_stamp="NOT_PASS")
    obs["product_stamp"] = {"PRODUCT_MEDIA_V1": "PASS"}
    result = jo.assess_observation(obs, product="ASR", expected_candidate_sha="a" * 40, pins=media.JOURNEY_PINS)
    assert result["gates"]["NO_WRITER_PROMOTION"] == "CONTRADICTED"
    assert "WRITER_SELF_PROMOTION" in {f["code"] for f in result["findings"]}
    assert result["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert result["may_promote"] is False
