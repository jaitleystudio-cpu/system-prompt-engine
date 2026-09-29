"""DOM threat, XSS resistance, and malicious input audit tests."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"
FIXTURES_PATH = WEB / "scripts" / "fixtures" / "malicious-inputs.json"


def test_malicious_inputs_fixtures_exist_and_cover_threats():
    assert FIXTURES_PATH.is_file(), "Malicious inputs fixture missing"
    data = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    fixtures = data.get("fixtures", [])
    assert len(fixtures) >= 10, "Expected at least 10 security fixtures"

    categories = {f["category"] for f in fixtures}
    assert "xss_script_tag" in categories
    assert "xss_img_onerror" in categories
    assert "xss_polyglot" in categories
    assert "delimiter_breakout" in categories
    assert "prototype_pollution" in categories
    assert "bounded_overflow" in categories


def test_node_dom_security_audit_passes():
    script = WEB / "scripts" / "test-dom-security-audit.mjs"
    assert script.is_file()

    result = subprocess.run(
        ["node", "--experimental-strip-types", str(script)],
        cwd=str(WEB),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"DOM security audit failed:\n{result.stderr}\n{result.stdout}"
    assert "ALL DOM & INPUT SECURITY AUDIT CHECKS PASSED" in result.stdout


def test_zero_dangerous_dom_apis_in_web_source():
    src = WEB / "src"
    assert src.is_dir()

    forbidden_patterns = [
        (re.compile(r"dangerouslySetInnerHTML"), "dangerouslySetInnerHTML"),
        (re.compile(r"\.innerHTML\s*="), "innerHTML assignment"),
        (re.compile(r"\.outerHTML\s*="), "outerHTML assignment"),
        (re.compile(r"document\.write\s*\("), "document.write()"),
        (re.compile(r"\beval\s*\("), "eval()"),
    ]

    for p in src.rglob("*"):
        if p.is_file() and p.suffix in {".ts", ".tsx", ".js", ".mjs"}:
            text = p.read_text(encoding="utf-8")
            for pattern, name in forbidden_patterns:
                match = pattern.search(text)
                assert not match, f"Dangerous DOM API '{name}' found in {p.relative_to(REPO)}"


def test_security_headers_and_csp_completeness():
    headers_file = WEB / "public" / "_headers"
    assert headers_file.is_file()
    headers_text = headers_file.read_text(encoding="utf-8")

    assert "Content-Security-Policy:" in headers_text
    assert "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload" in headers_text
    assert "X-Content-Type-Options: nosniff" in headers_text
    assert "Referrer-Policy: no-referrer" in headers_text
    assert "X-Frame-Options: DENY" in headers_text
    assert "Permissions-Policy:" in headers_text
    assert "Cross-Origin-Opener-Policy: same-origin" in headers_text
    assert "Cross-Origin-Resource-Policy: same-origin" in headers_text

    index_html = WEB / "index.html"
    assert index_html.is_file()
    html_text = index_html.read_text(encoding="utf-8")

    assert 'http-equiv="Content-Security-Policy"' in html_text
    assert 'http-equiv="X-Content-Type-Options" content="nosniff"' in html_text
    assert 'name="referrer" content="no-referrer"' in html_text
