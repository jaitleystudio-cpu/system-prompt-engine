# Contradiction map

SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

1. Home copy "A fresh start, every day." versus `dailyHero.ts` length 31, a deterministic rotation. Daily Lab source is a finite queue of 14 with `FINITE_QUEUE`.
2. Privacy page says reading a website contacts that address. CSP `connect-src 'self'` is the page policy, so a cross-origin fetch is not a granted browser connection.
3. Hero "any AI" versus a render-only ANY_AI adapter and no ChatGPT, Claude, or Cursor protocol adapters.
4. "Works offline once cached" and LOCAL_WASM `requires_network: false` versus a cold same-origin fetch of `spe_wasm.wasm` before the service worker can serve it.
5. Home idea cap 20000 versus Desired Output and Example caps 12000 versus Create idea with no `maxLength`.
6. `docs/UNIVERSAL_PLATFORM_ROADMAP.md` still marks WEB_PWA and WASM paths in planning language while `sw.js` and `public/spe_wasm.wasm` are shipped.
7. Official `npm run build` requires a gitignored wasm target. The tracked public wasm is what the engine fixture actually loads.
8. e2e script clicks `#spe-primary-nav` button named Create. That control was not found within 30s. Header markup was not changed.
9. Historical proof manifests bind other SHAs (including context-protocol material at `23e65f4e`). None reviewed here name `e0497f79898689a00a30abeab67652d5f6a9193c`.
10. ScrollStory mentions a private preview that may require sign-in. The app has no login. The sentence is about a future host, and hosting is forbidden.
11. `tools/run_mutations.py` exits not implemented, while Rust `negative_mutations` passed 2 tests. A stub and a passing kernel suite are different owners.
12. Python category engines cover C01, C02, C03, C06, C07. The registry lists C01–C12.
