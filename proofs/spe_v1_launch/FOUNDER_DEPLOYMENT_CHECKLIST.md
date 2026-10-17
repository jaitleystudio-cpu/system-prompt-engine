# Founder deployment checklist — SPE Website V1

Engineering tip ships \`apps/web/dist\` as a static site. Apex is currently **PARKED** (parkweb lander). Do not ask the agent to change DNS.

## Serve these from apex (HTTPS)

1. Build on the accepted SHA: \`cd apps/web && npm run build\`
2. Publish the entire \`apps/web/dist/\` tree:
   - \`index.html\` + hashed assets
   - \`spe_wasm.wasm\` (and copy-wasm outputs)
   - \`_headers\` (CSP / COOP as shipped)
   - \`/models\` (ONNX; lazy — not on Home)
   - \`/ort\` (onnxruntime wasm)
3. SPA fallback: unknown paths → \`index.html\` without breaking \`/models\` or \`/ort\`.
4. Confirm \`https://systempromptengine.com\` no longer returns the parkweb lander (Content-Length ~114).
5. Smoke: Home cinematic hero, Create ready CTA, Code upload, URL human copy, Daily Lab stage, My Work empty, Privacy/Proof.
6. Optional: QUALIFIED speech on Chrome desktop, Safari, Android Chrome, iPhone Safari.

## Do not

- Merge PR #41 from automation
- Point apex at a different product
- Add paid analytics / CDN that breaks privacy-first cost law without review
