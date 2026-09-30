# website-generator

Offline compiler for a versioned `WebsiteSpec`. `compile_site` writes deterministic HTML and CSS in memory. `write_static` can place those files in a local directory.

This package does not:

- call a model or claim an AI site engine
- emit WebGL, Three.js, or a 3D scene
- open a network connection
- host, deploy, or publish
- record telemetry or account fields

`sandbox_preview` returns `UNSUPPORTED`. `hosted_export` returns `HOLD`. Neither result is a pass.

Specs are private unless `metadata.visibility` is set to `public`. Public still means a local file, not a hosted site.

## Scope

Static pages only: hero, prose, list, and same-site call-to-action sections. Links must be root HTML files in the spec, or fragments. Script, iframe, and remote URL links are refused.
