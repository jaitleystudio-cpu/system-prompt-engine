"""Compile coverage and refusals for website-generator v1."""

from __future__ import annotations

import ast
import socket
from pathlib import Path

import jsonschema
import pytest

from website_generator import (
    compile_site,
    hosted_export,
    parse_spec,
    sandbox_preview,
    write_static,
)
from website_generator.compiler import SiteArtifact, StaticFile
from website_generator.errors import StaticWriteError, WebsiteSpecError
from website_generator.spec import SCHEMA_PATH, SPEC_VERSION

ROOT = Path(__file__).resolve().parents[1]

SAMPLE = {
    "spec_version": SPEC_VERSION,
    "title": "North Room",
    "summary": "A private static page.",
    "pages": [
        {
            "path": "index.html",
            "title": "Home",
            "sections": [
                {
                    "kind": "hero",
                    "heading": "Have an idea?",
                    "body": "Make it clear.\n\nStay on this page.",
                },
                {
                    "kind": "list",
                    "heading": "Included",
                    "items": ["Static HTML", "Static CSS"],
                },
                {
                    "kind": "cta",
                    "heading": "Next",
                    "body": "Read the notes.",
                    "cta_label": "Notes",
                    "cta_href": "notes.html#notes",
                },
            ],
        },
        {
            "path": "notes.html",
            "title": "Notes",
            "sections": [
                {
                    "kind": "prose",
                    "heading": "Notes",
                    "body": "No account. No network.",
                }
            ],
        },
    ],
}


def test_compile_is_deterministic_and_offline_html_css():
    first = compile_site(SAMPLE)
    second = compile_site(dict(SAMPLE))
    assert first.status == "PASS"
    assert first.network_mode == "NONE"
    assert first.hosted is False
    assert first.telemetry is False
    assert first.renderer == "static-html-css"
    assert first.as_map() == second.as_map()
    page = first.as_map()["index.html"]
    css = first.as_map()["assets/site.css"]
    assert "<!DOCTYPE html>" in page
    assert 'http-equiv="Content-Security-Policy"' in page
    assert "script-src 'none'" in page
    assert 'href="assets/site.css"' in page
    assert "<script" not in page.lower()
    assert "http://" not in page and "https://" not in css
    assert "@font-face" not in css
    assert "url(" not in css


def test_private_by_default_and_accessible_landmarks():
    page = compile_site(SAMPLE).as_map()["index.html"]
    assert 'lang="en"' in page
    assert 'data-theme="dark"' in page
    assert 'content="noindex, nofollow"' in page
    assert 'class="skip-link" href="#main"' in page
    assert "<header>" in page
    assert '<nav aria-label="Primary">' in page
    assert '<main id="main"' in page
    assert "<footer>" in page
    assert page.count("<h1") == 1
    assert 'aria-current="page"' in page
    assert ":focus-visible" in compile_site(SAMPLE).as_map()["assets/site.css"]
    assert "prefers-reduced-motion" in compile_site(SAMPLE).as_map()["assets/site.css"]
    assert "Offline static page" in page


def test_escapes_markup_and_marks_public_without_hosting():
    spec = {
        "spec_version": SPEC_VERSION,
        "title": "Room <lab>",
        "metadata": {"visibility": "public"},
        "theme": "light",
        "pages": [
            {
                "path": "index.html",
                "title": "Home",
                "sections": [
                    {
                        "kind": "prose",
                        "heading": "Copy",
                        "body": '<script>alert("x")</script>',
                    }
                ],
            }
        ],
    }
    page = compile_site(spec).as_map()["index.html"]
    assert 'data-theme="light"' in page
    assert "noindex" not in page
    assert "<script>" not in page
    assert "&lt;script&gt;" in page
    assert "Room &lt;lab&gt;" in page
    manifest = compile_site(spec).as_map()["site.manifest.json"]
    assert '"hosted": false' in manifest
    assert '"ai_site_engine": false' in manifest
    assert '"three_d": false' in manifest
    assert '"visibility": "public"' in manifest


def test_schema_accepts_sample_and_rejects_extra_fields():
    import json

    loaded = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(SAMPLE, loaded)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({**SAMPLE, "telemetry": False}, loaded)


def test_refuses_network_script_and_escape_links():
    for href in (
        "https://example.com",
        "//cdn.example.com/app.css",
        "javascript:alert(1)",
        "notes.html?x=1",
        "../secrets.html",
        "mailto:person@example.com",
    ):
        spec = _with_href(href)
        with pytest.raises(WebsiteSpecError):
            parse_spec(spec)


def test_refuses_account_telemetry_and_embed_claims():
    with pytest.raises(WebsiteSpecError):
        parse_spec({**SAMPLE, "email": "person@example.com"})
    with pytest.raises(WebsiteSpecError):
        parse_spec({**SAMPLE, "metadata": {"visibility": "private", "telemetry": True}})
    with pytest.raises(WebsiteSpecError):
        parse_spec({**SAMPLE, "emitter": "three"})
    bad_kind = {
        "spec_version": SPEC_VERSION,
        "title": "Room",
        "pages": [
            {
                "path": "index.html",
                "title": "Home",
                "sections": [{"kind": "iframe", "heading": "Embed", "body": "remote"}],
            }
        ],
    }
    with pytest.raises(WebsiteSpecError):
        parse_spec(bad_kind)


def test_hold_and_unsupported_are_not_pass():
    sandbox = sandbox_preview(SAMPLE)
    hosted = hosted_export(SAMPLE)
    assert sandbox.status == "UNSUPPORTED"
    assert hosted.status == "HOLD"
    assert sandbox.passed is False
    assert hosted.passed is False
    assert sandbox.network_mode == "NONE"
    assert hosted.network_mode == "NONE"


def test_compile_does_not_open_a_socket(monkeypatch: pytest.MonkeyPatch):
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network")

    monkeypatch.setattr(socket, "socket", boom)
    monkeypatch.setattr(socket, "create_connection", boom)
    artifact = compile_site(SAMPLE)
    assert artifact.network_mode == "NONE"


def test_write_static_stays_inside_destination(tmp_path: Path):
    written = write_static(compile_site(SAMPLE), tmp_path / "site")
    assert (tmp_path / "site" / "index.html").read_text(encoding="utf-8").startswith("<!DOCTYPE html>")
    assert (tmp_path / "site" / "assets" / "site.css").is_file()
    assert all(path.is_relative_to(tmp_path / "site") for path in written)
    escaped = SiteArtifact(
        spec_version=SPEC_VERSION,
        status="PASS",
        network_mode="NONE",
        hosted=False,
        renderer="static-html-css",
        telemetry=False,
        files=(StaticFile("../outside.txt", "nope\n", "text/plain"),),
    )
    with pytest.raises(StaticWriteError):
        write_static(escaped, tmp_path / "site")
    assert not (tmp_path / "outside.txt").exists()


def test_package_has_no_network_or_runtime_imports():
    forbidden = {
        "requests",
        "httpx",
        "aiohttp",
        "urllib",
        "urllib3",
        "socket",
        "openai",
        "anthropic",
        "spe_runtime",
    }
    offenders: list[str] = []
    for path in (ROOT / "website_generator").rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules.append(node.module)
            for name in modules:
                top = name.split(".")[0]
                if name in forbidden or top in forbidden:
                    offenders.append(f"{path.name}:{name}")
    assert offenders == []


def _with_href(href: str) -> dict[str, object]:
    return {
        "spec_version": SPEC_VERSION,
        "title": "Room",
        "pages": [
            {
                "path": "index.html",
                "title": "Home",
                "sections": [
                    {
                        "kind": "cta",
                        "heading": "Go",
                        "cta_label": "Go",
                        "cta_href": href,
                    }
                ],
            }
        ],
    }
