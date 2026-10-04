"""Page emitter stays on the reconstruction contract and drops script bodies."""

from __future__ import annotations

from spe_runtime.webrecon import (
    AcquisitionAuthorization,
    build_reconstruction_contract,
    emit_observed_page,
)

_SECRET = "SECRET_SCRIPT_BODY_do_not_emit"
_CSS_SECRET = "payload-css-secret"
_STYLE_ONLY = "StyleBlockFaceNotOnContract"
_HTML = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Harbor Ledger</title>
  <style>
    body {{ font-family: "{_STYLE_ONLY}", serif; background: url(data:image/svg+xml,{_CSS_SECRET}); }}
  </style>
</head>
<body>
  <p style="font-family: 'Iowan Old Style', serif; font-size: 18px">Visible sentence</p>
  <script>{_SECRET}()</script>
  <script src="/vendor/three.module.js">ALSO_BODY</script>
</body>
</html>
"""


def test_emitter_does_not_include_script_bodies() -> None:
    contract = build_reconstruction_contract(
        url="https://harbor.example/books",
        authorization=AcquisitionAuthorization(
            authorization_id="emit-script-1",
            allowed_hosts=("harbor.example",),
            allowed_schemes=("https",),
        ),
        html=_HTML,
        captured_at="2026-10-04T00:00:00Z",
    )
    assert contract.xray is not None
    families = [token.font_family or "" for token in contract.xray.typography]
    assert any("Iowan Old Style" in family for family in families)
    assert all(_STYLE_ONLY not in family for family in families)
    page = emit_observed_page(contract)
    assert _SECRET not in page
    assert "ALSO_BODY" not in page
    assert "<script" not in page.lower()
    assert _CSS_SECRET not in page
    assert _STYLE_ONLY not in page
    assert "Visible sentence" in page
    assert "Iowan Old Style" in page
    assert page != _HTML
