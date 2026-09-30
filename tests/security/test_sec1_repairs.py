"""Repair oracles for SEC1-14, SEC1-16, and SEC1-18.

These assertions reuse the C7 runtime probe and the grounding firewall.
They fail while the donor still fetches dot-dot URLs, keeps authority
booleans, or treats a missing connect-src as allow.
"""

from __future__ import annotations

from pathlib import Path

from spe_runtime.grounding.firewall import sanitize_external_payload
from tests.security.sec1_oracle import repo_root_from, run_runtime

REQUIRED_TRAVERSAL = (
    "parent",
    "parents",
    "encoded_dots",
    "encoded_dots_upper",
    "encoded_dot_mixed",
    "encoded_dot_mixed_tail",
    "dot_encoded_slash",
    "encoded_dot_slash",
    "double_encoded",
    "double_encoded_slash",
    "backslash",
    "mixed_slash",
)
AUTHORITY_KEYS = ("bypass", "authorized", "isAdmin", "auth_bypass")


def _repo() -> Path:
    return repo_root_from(Path(__file__).resolve())


def test_sec1_14_traversal_never_fetches() -> None:
    runtime = run_runtime(_repo())
    cases = {item["name"]: item for item in runtime["traversal_cases"]}
    assert set(cases) == set(REQUIRED_TRAVERSAL)
    for name in REQUIRED_TRAVERSAL:
        assert cases[name]["fetch"] == 0, name
    assert runtime["traversal_fetch"] is False
    assert runtime["query_fragment_authority_changed"] is False
    assert runtime["query_fragment_off_origin_fetch"] is False


def test_sec1_16_authority_fields_are_not_effective() -> None:
    for key in AUTHORITY_KEYS:
        cleaned = sanitize_external_payload({"claim": "note", "title": "battery", key: True})
        assert cleaned.get(key) is not True
        assert key not in cleaned
        assert cleaned["claim"] == "note"
        assert cleaned["title"] == "battery"
        assert "UNTRUSTED_SOURCE" in cleaned["taint_labels"]

    described = sanitize_external_payload(
        {
            "claim": "authorized readers may quote the cell study",
            "authorized": "the editor described this source",
        }
    )
    assert "authorized" not in described
    assert "cell study" in described["claim"]

    nested = sanitize_external_payload(
        {
            "meta": {"Bypass": True, "topic": "anode"},
            "rows": [
                {"IsAdmin": True, "name": "row-a"},
                {"auth-bypass": True, "name": "row-b"},
                {"AUTH_BYPASS": True, "note": "keep"},
            ],
            "wrapper": {"is_admin": True, "ok": 1},
        }
    )
    assert "Bypass" not in nested["meta"]
    assert nested["meta"]["topic"] == "anode"
    assert "IsAdmin" not in nested["rows"][0]
    assert nested["rows"][0]["name"] == "row-a"
    assert "auth-bypass" not in nested["rows"][1]
    assert nested["rows"][1]["name"] == "row-b"
    assert "AUTH_BYPASS" not in nested["rows"][2]
    assert nested["rows"][2]["note"] == "keep"
    assert "is_admin" not in nested["wrapper"]
    assert nested["wrapper"]["ok"] == 1


def test_sec1_18_missing_connect_src_is_not_approval() -> None:
    runtime = run_runtime(_repo())
    assert runtime["absent_policy_allowed"] is False
    assert runtime["empty_policy_allowed"] is False
    assert runtime["absent_policy_fetch"] is False
    assert runtime["default_src_fallback_blocks_remote"] is True
    assert runtime["explicit_connect_src_beats_default"] is True
    assert runtime["missing_both_connect_denied"] is True

    headers = (_repo() / "apps/web/public/_headers").read_text(encoding="utf-8")
    assert "connect-src 'self'" in headers
    assert "default-src 'self'" in headers
    assert "style-src 'self' 'unsafe-inline'" in headers
    assert "script-src 'self' 'wasm-unsafe-eval'" in headers
    script = headers.split("script-src", 1)[1].split(";", 1)[0]
    script_tokens = script.replace("'", "").split()
    assert "unsafe-inline" not in script_tokens
    assert "unsafe-eval" not in script_tokens
    assert "wasm-unsafe-eval" in script_tokens
    assert "frame-ancestors 'none'" in headers
    assert "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" in headers
