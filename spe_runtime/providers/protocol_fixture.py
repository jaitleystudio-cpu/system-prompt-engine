"""Deterministic local OpenAI-compatible HTTP fixture for PROTOCOL_CONFORMANCE.

This is NOT a live external provider.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable


class ProtocolFixture:
    def __init__(self, handler_fn: Callable[[dict[str, Any]], tuple[int, dict[str, Any]]]):
        self._handler_fn = handler_fn
        self.last_request_body: dict[str, Any] | None = None
        self.last_headers: dict[str, str] = {}
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.base_url = ""

    def start(self) -> str:
        outer = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
                return

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                try:
                    body = json.loads(raw.decode("utf-8"))
                except json.JSONDecodeError:
                    body = {}
                outer.last_request_body = body if isinstance(body, dict) else {}
                outer.last_headers = {k: v for k, v in self.headers.items()}
                status, resp = outer._handler_fn(outer.last_request_body)
                data = json.dumps(resp).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), H)
        host, port = self._httpd.server_address
        self.base_url = f"http://{host}:{port}/v1"
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self.base_url

    def stop(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None


def default_chat_handler(body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Echo-ish deterministic handler for portable baseline."""
    msgs = body.get("messages") or []
    user = ""
    for m in msgs:
        if isinstance(m, dict) and m.get("role") == "user":
            user = str(m.get("content") or "")
    # Hard constraint echo
    text = "OK"
    if "MUST_NOT" in user or "secret" in user.lower():
        text = "refusing forbidden action; answer=4"
    if "2+2" in user or "arithmetic" in user.lower():
        text = "4"
    if body.get("response_format"):
        text = json.dumps({"answer": 4, "ok": True})
    if body.get("tools"):
        return 200, {
            "id": "chatcmpl-fixture",
            "model": body.get("model") or "fixture-model",
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "tool_calls",
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "type": "function",
                                "function": {
                                    "name": "add_integers",
                                    "arguments": '{"a":2,"b":2}',
                                },
                            }
                        ],
                    },
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }
    return 200, {
        "id": "chatcmpl-fixture",
        "model": body.get("model") or "fixture-model",
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {"role": "assistant", "content": text},
            }
        ],
        "usage": {"prompt_tokens": 8, "completion_tokens": 3},
    }


__all__ = ["ProtocolFixture", "default_chat_handler"]
