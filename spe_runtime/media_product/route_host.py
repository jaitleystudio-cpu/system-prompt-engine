"""Production route in front of the pinned LocalMediaSession.

Not a second engine. This process is started by the app server. The browser
reaches it only through the app's same-origin /api/media route.

File proof does not flip v1. This route calls product_gates. PRODUCT_MEDIA_V1
becomes PASS only after one journey on this route recorded absence, verified
model ingress, a verified CLI build, LOCAL_NEURAL, and user-audio egress 0.
A mount string is not that journey.

Ownership, from spe_runtime/media_product/local_backend.py:
- Runtime creation: LocalMediaSession.open(discover_qualified_assets()).
- Model location: discover_qualified_assets() verifies media-pack/PACK_MANIFEST.json and, only when the ggml file is absent, fetches SOURCE (model ingress, then sha256). When whisper-cli is absent it builds the pinned whisper.cpp commit into that pack.
- Lifecycle: LocalMediaSession.transcribe_path (decode, energy gate, whisper-cli).
- Cancellation: LocalMediaSession.cancel() sets the event and SIGTERMs the CLI group.
- Cleanup: LocalMediaSession.close() drops PCM buffers and unlinks session temps.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

from spe_runtime.media_product.local_backend import (
    IntegrityError,
    LocalMediaSession,
    commit_product_journey,
    discover_qualified_assets,
    product_gates,
    recorded_journey,
)

_MAX_BYTES = 32 * 1024 * 1024
_LOCK = threading.Lock()
_JOBS: dict[str, "Job"] = {}
_STATE = {
    "last_temp_files_remaining": 0,
    "last_upload_removed": True,
    "last_error": "",
    "egress_attempts": 0,
}
_ALLOWED_SUFFIXES = {
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".oga",
    ".m4a",
    ".aac",
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".m4v",
}


class Job:
    def __init__(self) -> None:
        self.cancel = threading.Event()
        self.session: LocalMediaSession | None = None
        self.session_lock = threading.Lock()


def _public(
    status: str,
    mode: str,
    error_code: str | None,
    text: str = "",
    neural: bool = False,
    egress: int = 0,
    progress: int | None = None,
) -> dict[str, object]:
    if mode == "LOCAL_NEURAL" and not neural:
        mode = "UNAVAILABLE"
        status = "ERROR"
        error_code = "FALSE_NEURAL"
        text = ""
    if status in {"CANCELLED", "NO_SPEECH"}:
        mode = "UNAVAILABLE" if status == "CANCELLED" else "LOCAL_FALLBACK"
        neural = False
        text = ""
    return {
        "status": status,
        "text": text,
        "mode": mode,
        "errorCode": error_code,
        "neuralSessionRan": neural,
        "timestampsProven": False,
        "segments": [],
        "progressPercent": progress,
        "egressAttempts": egress,
    }


def _from_transcript(result: object) -> dict[str, object]:
    status = str(getattr(result, "status"))
    mode = str(getattr(result, "mode"))
    neural = bool(getattr(result, "neural_session_ran"))
    text = str(getattr(result, "text") or "")
    error_code = getattr(result, "error_code")
    error = None if error_code is None else str(error_code)
    egress = int(getattr(result, "egress_attempts") or 0)
    progress = getattr(result, "progress_percent")
    shown_progress = progress if isinstance(progress, int) and 0 <= progress <= 100 else None
    if status == "CANCELLED":
        return _public("CANCELLED", "UNAVAILABLE", "CANCELLED", egress=egress)
    if status == "NO_SPEECH" or (status == "SPEECH" and not text.strip()):
        return _public("NO_SPEECH", "LOCAL_FALLBACK", None, egress=egress)
    if status == "SPEECH":
        if not neural or mode != "LOCAL_NEURAL":
            return _public("ERROR", "UNAVAILABLE", "FALSE_NEURAL", egress=egress)
        return _public("SPEECH", "LOCAL_NEURAL", None, text=text, neural=True, egress=egress, progress=shown_progress)
    if error == "CORRUPT":
        return _public("ERROR", "UNAVAILABLE", "CORRUPT", egress=egress)
    if error in {"NO_AUDIO_TRACK", "FILE_MISSING"}:
        neural = False
        if mode == "LOCAL_NEURAL":
            mode = "LOCAL_FALLBACK"
    if mode == "LOCAL_NEURAL" and not neural:
        return _public("ERROR", "UNAVAILABLE", "FALSE_NEURAL", egress=egress)
    return _public(status if status == "ERROR" else "ERROR", mode, error or "ERROR", neural=neural, egress=egress, progress=shown_progress)


def _suffix(name: str) -> str:
    token = unquote(name or "")
    suffix = Path(token).suffix.lower()
    return suffix if suffix in _ALLOWED_SUFFIXES else ".bin"


def request_cancel(job_id: str) -> bool:
    with _LOCK:
        job = _JOBS.get(job_id)
    if job is None:
        return False
    job.cancel.set()
    with job.session_lock:
        session = job.session
    if session is not None:
        session.cancel()
    return True


def _run_job(job: Job, media_path: Path) -> dict[str, object]:
    try:
        assets = discover_qualified_assets()
    except IntegrityError as exc:
        _STATE["last_error"] = str(exc)
        return _public("ERROR", "UNAVAILABLE", f"PINNED_ASSET_MISSING:{exc}"[:500])
    session = LocalMediaSession.open(assets)
    with job.session_lock:
        job.session = session
    try:
        if job.cancel.is_set():
            payload = _public("CANCELLED", "UNAVAILABLE", "CANCELLED")
        else:
            result = session.transcribe_path(media_path)
            if result.mode == "LOCAL_NEURAL" and result.neural_session_ran:
                print(
                    f"LOCAL_NEURAL user_audio_egress={int(result.egress_attempts)}",
                    file=sys.stderr,
                    flush=True,
                )
            verdict, gap, became = commit_product_journey(assets, result)
            if became:
                print(
                    f"PRODUCT_MEDIA_V1 {verdict} remainingGap={gap}",
                    file=sys.stderr,
                    flush=True,
                )
            payload = _from_transcript(result)
        _STATE["last_error"] = ""
        _STATE["egress_attempts"] = int(payload["egressAttempts"])
        return payload
    finally:
        session.close()
        _STATE["last_temp_files_remaining"] = session.temp_files_remaining


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _send(self, code: int, payload: dict[str, object]) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/health":
            self._send(404, {"error": "NOT_FOUND"})
            return
        with _LOCK:
            active = len(_JOBS)
        gates = product_gates(
            local_file_transcription="UNAVAILABLE",
            raw_media_egress=int(_STATE["egress_attempts"]),
            journey=recorded_journey(),
        )
        self._send(
            200,
            {
                "owner": "LocalMediaSession",
                "activeJobs": active,
                "egressAttempts": int(_STATE["egress_attempts"]),
                "lastTempFilesRemaining": int(_STATE["last_temp_files_remaining"]),
                "lastUploadRemoved": bool(_STATE["last_upload_removed"]),
                "lastError": _STATE["last_error"],
                "productMediaV1": gates["PRODUCT_MEDIA_V1"],
                "remainingGap": gates["REMAINING_GAP"],
            },
        )

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length") or "0")
        if length < 0 or length > _MAX_BYTES:
            self._send(413, _public("ERROR", "UNAVAILABLE", "FILE_TOO_LARGE"))
            return
        body = self.rfile.read(length) if length else b""
        if path == "/cancel":
            try:
                payload = json.loads(body.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                self._send(400, _public("ERROR", "UNAVAILABLE", "BAD_CANCEL"))
                return
            job_id = str(payload.get("jobId") or "")
            self._send(200, {"ok": True, "cancelled": request_cancel(job_id)})
            return
        if path != "/transcribe":
            self._send(404, _public("ERROR", "UNAVAILABLE", "NOT_FOUND"))
            return
        job_id = str(self.headers.get("X-Spe-Job-Id") or "")
        if not job_id or len(job_id) > 80 or any(ch not in "0123456789abcdefABCDEF-" for ch in job_id):
            self._send(400, _public("ERROR", "UNAVAILABLE", "BAD_JOB"))
            return
        job = Job()
        with _LOCK:
            _JOBS[job_id] = job
        directory = Path(tempfile.mkdtemp(prefix="spe-media-"))
        media_path = directory / f"upload{_suffix(str(self.headers.get('X-Spe-File-Name') or ''))}"
        payload: dict[str, object]
        try:
            media_path.write_bytes(body)
            if job.cancel.is_set():
                payload = _public("CANCELLED", "UNAVAILABLE", "CANCELLED")
            else:
                payload = _run_job(job, media_path)
        except Exception as exc:
            _STATE["last_error"] = f"{type(exc).__name__}:{exc}"[:500]
            print(f"MEDIA_HOST_ERROR {_STATE['last_error']}", file=sys.stderr, flush=True)
            payload = _public("ERROR", "UNAVAILABLE", "HOST_ERROR")
        finally:
            shutil.rmtree(directory, ignore_errors=True)
            _STATE["last_upload_removed"] = not media_path.exists() and not directory.exists()
            with _LOCK:
                _JOBS.pop(job_id, None)
        print(
            f"MEDIA_RESULT {payload.get('status')} {payload.get('mode')} {payload.get('errorCode')}",
            file=sys.stderr,
            flush=True,
        )
        self._send(200, payload)


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = int(server.server_address[1])
    print(f"MEDIA_HOST {port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
