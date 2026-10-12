# Custody
- Frozen candidate: 9637907459334cb31d2f8e0c481baf896a9ce5a4 (PR #147 head, refreshed 2026-10-12 13:32 IST via git ls-remote; equals owner-observed SHA). Base candidate/2026-10-26 = be65bf2.
- Audit branch: grok/prehosting-acceptance-r1 (new), worktree /Volumes/4TB-WD/spe-worktrees/spe-prehosting-r1.
- Env: macOS 27.2 (26B5101f), Node 22.23.2, npm 10.9.8, Playwright 1.49.1 Chromium (headless), Lighthouse 12, axe-core 4, autocannon 7, Mac mini.
- Build: `npm ci && npm run build` in apps/web -> exit 0 (copy-check, canonical WASM build, tsc, vite). Reproducibility (bit-for-bit second build): NOT_TESTED.
- All measurements against `vite preview` on 127.0.0.1:4173 (NOT the production host; _headers/_redirects are not applied by vite preview).
- Caveat: the owner brief as delivered to this auditor was truncated in the middle (~16k chars of Phases 1-13 not visible). Sections audited are those visible + standard practice; exact owner-check fidelity = UNRESOLVED.
