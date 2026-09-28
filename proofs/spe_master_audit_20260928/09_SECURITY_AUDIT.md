# Security audit

This is not a penetration test.

## What ran

- CSP source contract passed (`test:predeploy-qa`).
- Dependency name gate passed (`audit:deps`). It is not an advisory database scan.
- Egress during evaluate was zero.
- Rust `malicious_source_payload_rejected` passed.
- Rust capability tests: missing capability does not fake success; authority is not inferred; core cannot run local execution.
- Deployment gate failed closed on live hosting checks: ddos, bandwidth, tls, security_headers_live, cache_policy, abuse, billing, founder_unlock.
- Vite warned that `onnxruntime-web` uses `eval`.
- WASM sha256 of the committed artifact matched the engine fixture.
- No secrets scanner ran.
- Service worker source is same-origin and was not attacked.

## Authority

Network, credentials, and external writes are denied for the local dry-run record (authority NONE, executed false). URL fetch and browser speech are separate user-triggered paths. Repository, file, and computer-use capabilities are declared and not executable in `apps/web`.

## Supply chain

`audit:deps` allows `three` and `@react-three/fiber` as visual dependencies and reported no banned hits. No SBOM diff or signature verification beyond the wasm sha256 check was done.
