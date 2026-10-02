"""G4: website-generator output must not claim unavailable capabilities.

The package is a library. It must refuse unsafe links and must not emit
raw script HTML. LIVE_RECONSTRUCTION, HOSTED_PUBLISH, SCENE_3D, and
AI_GENERATION stay unavailable. This test does not fetch or deploy.
"""

from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[2] / "packages" / "website-generator"
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from website_generator import compile_site, hosted_export, parse_spec, sandbox_preview
from website_generator.errors import WebsiteSpecError

_FORBIDDEN_AVAILABLE = (
    "LIVE_RECONSTRUCTION=AVAILABLE",
    "LIVE_RECONSTRUCTION: AVAILABLE",
    "HOSTED_PUBLISH=AVAILABLE",
    "HOSTED_PUBLISH: AVAILABLE",
    "SCENE_3D=AVAILABLE",
    "SCENE_3D: AVAILABLE",
    "AI_GENERATION=AVAILABLE",
    "AI_GENERATION: AVAILABLE",
    '"LIVE_RECONSTRUCTION": "AVAILABLE"',
    '"HOSTED_PUBLISH": "AVAILABLE"',
    '"SCENE_3D": "AVAILABLE"',
    '"AI_GENERATION": "AVAILABLE"',
)

_SPEC = {
    "spec_version": "website-spec/1",
    "title": "G4 Room",
    "summary": "Offline static page.",
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


def test_generator_output_does_not_claim_unavailable_capabilities() -> None:
    artifact = compile_site(_SPEC)
    assert artifact.hosted is False
    assert artifact.network_mode == "NONE"
    assert artifact.renderer == "static-html-css"
    blob = "\n".join(artifact.as_map().values())
    for claim in _FORBIDDEN_AVAILABLE:
        assert claim not in blob
    manifest = artifact.as_map()["site.manifest.json"]
    assert '"hosted": false' in manifest
    assert '"ai_site_engine": false' in manifest
    assert '"three_d": false' in manifest
    assert hosted_export().status == "HOLD"
    assert hosted_export().passed is False
    assert sandbox_preview().status == "UNSUPPORTED"
    assert sandbox_preview().passed is False


def test_unsafe_html_and_href_do_not_succeed() -> None:
    page = compile_site(_SPEC).as_map()["index.html"]
    assert "<script" not in page.lower()
    assert "&lt;script&gt;" in page
    for href in ("javascript:alert(1)", "https://evil.example/", "<script>"):
        spec = {
            "spec_version": "website-spec/1",
            "title": "G4 Room",
            "pages": [
                {
                    "path": "index.html",
                    "title": "Home",
                    "sections": [
                        {
                            "kind": "cta",
                            "heading": "Next",
                            "cta_label": "Go",
                            "cta_href": href,
                        }
                    ],
                }
            ],
        }
        try:
            parse_spec(spec)
        except WebsiteSpecError:
            continue
        raise AssertionError(f"unsafe href was accepted: {href}")
