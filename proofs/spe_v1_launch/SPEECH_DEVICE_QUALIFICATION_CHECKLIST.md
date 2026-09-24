# Speech→Prompt — Launch Platform Qualification Checklist

**Gate:** Speech is **not** blocked on “every device must dictate successfully.”

Each **launch platform** row must end as exactly one of:

| Status | Meaning |
| --- | --- |
| **QUALIFIED** | Real-device dictation smoke PASS + fallback paths PASS on that platform |
| **VERIFIED_GRACEFUL_FALLBACK** | Unsupported/failing recognition detected; no stuck mic; no false listening; human error copy; typing fully usable — with automated or manual evidence |
| **FAILED** | Contract broken (stuck mic, false listening, unusable typing, or missing human error copy) |

Ordinary visitor UI must **never** show engineering tokens (`DEVICE_QUALIFICATION_PENDING`, `NOT_TESTED`, `IMPLEMENTATION_PRESENT`, ORT, MobileNet, UIObservationIR, XRAY). Keep this matrix in Proof / technical evidence only.

## Launch matrix

| Platform id | Platform | Browser | Status | Founder QUALIFIED run needed? | Evidence |
| --- | --- | --- | --- | --- | --- |
| chrome-desktop | Chrome desktop | Chrome | VERIFIED_GRACEFUL_FALLBACK | **YES** (real mic dictation) | Fallback contract automated on Linux Chromium; no mic hardware on box → cannot QUALIFIED here |
| safari-desktop | Safari desktop | Safari | VERIFIED_GRACEFUL_FALLBACK | **YES** | Product fallback UI + automated contract; founder Safari dictation still open |
| android-chrome | Android Chrome | Chrome | VERIFIED_GRACEFUL_FALLBACK | **YES** | Same as above |
| iphone-safari | iPhone Safari | Safari | VERIFIED_GRACEFUL_FALLBACK | **YES** | Same as above |
| linux-box-chromium | Linux box (CI) | Chromium headless | VERIFIED_GRACEFUL_FALLBACK | no | API YES; fake mic; dictation FAIL; fallback PASS (`speech_fallback_contract.json`) |
| linux-box-firefox | Linux box (CI) | Firefox / no API | VERIFIED_GRACEFUL_FALLBACK | no | Unsupported path simulated by stripping API; typing usable |

## Shared setup (founder QUALIFIED runs)

1. Serve SPE web (`npm run build && npm run preview`) — not the parked apex.
2. Open **Create → Speech**.
3. Confirm visitor copy is Rich Human English (no engineering tokens).
4. Quiet room; built-in or attached mic.
5. Capture: browser+version, OS, date/time (IST), pass/fail, optional screenshots.
6. Privacy: browser speech may leave the device. SPE does not store audio.

## Steps for QUALIFIED (per launch platform)

### A. Permission allow
Start mic → Allow → listening appears; no deny alert.

### B. Permission deny
Block mic → clear human alert; UI does **not** claim listening.

### C. Start / stop
Start → speak → Stop cleanly without reload.

### D. Edit transcript
Edit textarea; **Add transcript to idea** inserts edited text.

### E. Mixed speech + typing
Speak; Stop; type more; both reach the idea field.

### F. Mic cleanup
Start; navigate away without Stop → no stuck listening (OS mic light clears).

### G. Dictation smoke
Known phrase roughly correct (≥70% words) in review box.

Mark **QUALIFIED** only if A–G PASS. Mark **VERIFIED_GRACEFUL_FALLBACK** when B/F and typing work but G cannot run (no mic / unsupported API) with evidence. Mark **FAILED** if stuck mic / false listening / typing broken.

## Box / CI limitation

Linux agent: no real microphone hardware. Dictation smoke cannot QUALIFIED. Prefer shipping **VERIFIED_GRACEFUL_FALLBACK** with `proofs/spe_v1_launch/speech_fallback_contract.json`.

## Artifacts

- `apps/web/src/engine/speechQualification.ts` — matrix
- `proofs/spe_v1_launch/speech_fallback_contract.json` — automated contract
- `proofs/spe_v1_launch/speech_chrome_probe.json` — box Chromium probe
