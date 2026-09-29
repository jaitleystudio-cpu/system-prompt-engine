# WebRecon v1 scope

Date: 2026-09-30
Owner: `spe_runtime/webrecon`
Contract ids: `spe.webrecon.website-xray.v1`, `spe.webrecon.reconstruction-contract.v1`

## Boundary

An explicit host allowlist plus an already captured HTML document, and optional CSS, becomes a Website X-Ray inside a reconstruction contract.

`build_reconstruction_contract` does not open a socket. `network_mode` other than `NONE` is refused. `network_performed` and `k3_integrated` stay false. `semantic_authority` stays `NONE`.

## What the contract contains

- Acquisition decision for the URL: scheme, exact host, credentials, and restricted-host checks.
- Isolation report. Scripts, event handlers, `javascript:` URLs, CSS `expression` / `behavior` / `-moz-binding`, and `data:` payloads are quarantined. The contract keeps a digest, not the payload.
- HTML/CSS metadata: doctype, language, charset, title, viewport, meta, stylesheet links, custom properties.
- Asset inventory with `NOT_FETCHED`, `INLINE`, or `QUARANTINED`. Script assets are `execution: FORBIDDEN`.
- Source-order layout tree. It is not a browser box tree.
- Typography tokens hashed from observed font fields. No role names are assigned.
- Breakpoints copied from `@media` queries. No device class is assigned.
- Interaction inventory for links, buttons, forms, fields, disclosures, dialogs, and CSS pseudo-states. Field values are omitted.
- Scroll, animation, and transition observations. A camera is recorded only when the capture declares one.
- WebGL / Three.js observation. Canvas and library filenames can be noted. `executed` is false. A sidecar cannot flip it to true.
- Obligations, prohibitions, gaps, and standing limitations.

## What this refuses to do

- Live fetch, DNS resolution, script execution, and WebGL execution.
- K3, XCAT, quality scoring, category assignment, provider adapters, and semantic-core edits.
- Hosting, deployment, and a pass/fail product score.

`html.parser` is a data reader, not a browser. Linked stylesheets are listed and not downloaded.

## Check

```bash
python -m pytest tests/unit/test_webrecon_foundation.py -q
```

On 2026-09-30 that file reported `8 passed`. That count is the unit file only.
