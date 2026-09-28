# PRIVACY MATRIX

| Input / path | Stays local? | Network required? | Raw source stored? | Browser storage? | Optional external action? | Current limitation |
|---|---|---|---|---|---|---|
| TEXT | Yes (prep) | No | Only if user opts into My Work history | Optional localStorage history | Copy/download / paste elsewhere | Home quick-start 20k |
| SPEECH | Audio not stored by SPE | Browser speech service may use vendor path | Transcript enters idea text | Same as text if history on | Browser speech | Support varies by browser |
| IMAGE | Yes (local pixel notes) | Optional same-origin model pack | Not persisted by default | No by default | User export/copy | Bound file/MP limits |
| SCREENSHOT | Yes | Optional same-origin model pack | Not persisted by default | No by default | Coding AI outside SPE | Scaffold ≠ compile |
| VIDEO | Yes (frame sample) | No remote vision API | Not persisted by default | No by default | User export/copy | Duration/frame caps |
| URL | Reference kept; remote HTML generally **not** read | Same-origin only under CSP | Reference in idea if added | No by default | Upload HTML/screenshot | `url_reference_only` for remote |
| FILE (HTML upload) | Yes | No | Bounded bytes used in brief | No by default | — | 200k processing budget; 2MB file cap |
| EXTERNAL PROVIDER | N/A — SPE does not call cloud AI to prepare | User-chosen destination after copy | N/A | N/A | User pastes elsewhere | Destination rules apply |
| Theme | Preference local | No | Preference only | localStorage | — | Device-local |
| PWA shell | Cached shell assets | Same-origin fetch for shell/WASM/models | Cache API for shell | SW caches | — | Not private prompt bodies |

Aligned Privacy page: `apps/web/src/pages/PrivacyProof.tsx`
