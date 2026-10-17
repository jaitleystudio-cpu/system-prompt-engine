# CLAIM TRUTH TABLE — Truth / Privacy Closure 20260928

| CLAIM | ACTUAL IMPLEMENTATION | MISMATCH | OWNER | CHOSEN FIX |
|---|---|---|---|---|
| “Reading a website contacts the address you type” | CSP `connect-src 'self'` blocks arbitrary remote fetch | Contradicted CSP | `PrivacyProof.tsx`, `_headers`, `index.html` | Honest reference-only copy + `url_reference_only` |
| “Fetch in browser” succeeds for remote URLs | Cross-origin fetch not authorized under CSP | Overclaim | `UnifiedComposer.tsx`, `urlIngest.ts` | Button/status → URL reference; policy gate before fetch |
| Home accepts paste beyond 20k silently via `maxLength` | Browser truncates without notice | Silent loss | `Hero.tsx` | Remove `maxLength`; `applyTextBound` + meter + notice |
| Desired Output / Example `maxLength={12000}` | Silent HTML truncation | Silent loss | `UnifiedComposer.tsx` | Same bound helper + meters |
| URL/HTML sliced to 200,000 bytes | Slice without user disclosure / provenance | Hidden source loss | `urlIngest.ts`, types | `sourceBounds` + UI notice |
| Screenshot→code “compiles” targets | Prompt + starter scaffolds only | Potential overclaim | `App.tsx`, composer, routing | Explicit prompt/scaffold / coding-AI wording |
| Everything always on device | Optional history/theme localStorage; speech may use browser service; same-origin model packs | Absolute wording risk | Privacy | Scoped claims; optional paths named |

BASE SHA: `cab1e5e241e6e793f7fa20999bbced5298209a44`
