# STORAGE AUDIT

| Mechanism | Used? | What |
|---|---|---|
| localStorage | Yes | Theme preference; optional My Work history (opt-in) |
| sessionStorage | No (not found in owners) | — |
| IndexedDB | No | — |
| OPFS | No | — |
| Cache API / SW caches | Yes | Same-origin shell/assets via `sw.js` — not private prompt bodies by design |
| Service worker | Yes | Registration + update signaling |

## Wording rule applied

- “Not stored” is not used for paths that persist on-device.
- Distinguish **stored on this device** vs **sent remotely**.
- Privacy page names optional history + theme local storage.
