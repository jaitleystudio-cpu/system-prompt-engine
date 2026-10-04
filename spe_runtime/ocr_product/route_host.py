"""Same-origin route in front of the pinned LocalOcrSession.

Not a second engine. The browser reaches it only through /api/ocr on
loopback. OCR_PRODUCT stays HOLD until this process has verified the pack
and recognized non-empty text with raw image egress 0.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from spe_runtime.ocr_product.local_backend import (
    IntegrityError,
    LocalOcrSession,
    discover_qualified_assets,
    ingress_hosts,
    product_verdict,
)

_MAX_BYTES = 20 * 1024 * 1024
_LOCK = threading.Lock()
_SESSION: LocalOcrSession | None = None
_LAST_ERROR = ""


def _session() -> LocalOcrSession:
    global _SESSION, _LAST_ERROR
    with _LOCK:
        if _SESSION is not None:
            return _SESSION
        try:
            assets = discover_qualified_assets()
            _SESSION = LocalOcrSession.open(assets)
            _LAST_ERROR = ""
            return _SESSION
        except IntegrityError as exc:
            _LAST_ERROR = exc.code
            raise


def _health() -> dict[str, object]:
    verdict = product_verdict()
    error = ""
    try:
        _session()
    except IntegrityError as exc:
        error = exc.code
        verdict = {
            "OCR_PRODUCT": "HOLD",
            "missing": exc.code,
            "ingressHosts": ingress_hosts(),
            "imageEgressAttempts": verdict.get("imageEgressAttempts", 0),
        }
    body: dict[str, object] = {
        "owner": "LocalOcrSession",
        "engine": "tesseract",
        "OCR_PRODUCT": verdict["OCR_PRODUCT"],
        "missing": verdict["missing"],
        "ingressHosts": verdict["ingressHosts"],
        "imageEgressAttempts": verdict["imageEgressAttempts"],
        "error": error,
    }
    return body


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _json(self, code: int, payload: dict[str, object]) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/health":
            self._json(404, {"status": "ERROR", "mode": "UNAVAILABLE", "errorCode": "NOT_FOUND", "text": "", "regions": [], "egressAttempts": 0})
            return
        self._json(200, _health())

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/recognize":
            self._json(404, {"status": "ERROR", "mode": "UNAVAILABLE", "errorCode": "NOT_FOUND", "text": "", "regions": [], "egressAttempts": 0})
            return
        length = int(self.headers.get("content-length") or "0")
        if length <= 0 or length > _MAX_BYTES:
            self._json(400, {"status": "ERROR", "mode": "UNAVAILABLE", "errorCode": "DECODE", "text": "", "regions": [], "egressAttempts": 0})
            return
        blob = self.rfile.read(length)
        try:
            session = _session()
        except IntegrityError as exc:
            self._json(
                503,
                {
                    "status": "ERROR",
                    "mode": "UNAVAILABLE",
                    "errorCode": exc.code,
                    "text": "",
                    "regions": [],
                    "egressAttempts": 0,
                },
            )
            return
        with _LOCK:
            result = session.recognize(blob)
        self._json(
            200,
            {
                "status": "OK" if result.mode == "LOCAL_OCR" else "ERROR",
                "mode": result.mode,
                "errorCode": result.error_code,
                "text": result.text,
                "regions": result.regions,
                "egressAttempts": result.egress_attempts,
                "networkHosts": result.network_hosts,
                "engineRan": result.engine_ran,
            },
        )


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = int(server.server_address[1])
    print(f"OCR_HOST {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
