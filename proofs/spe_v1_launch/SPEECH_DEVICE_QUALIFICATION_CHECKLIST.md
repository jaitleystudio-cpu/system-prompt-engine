# Speech→Prompt — Founder Device Qualification Checklist

Status gate: Speech remains **DEVICE_QUALIFICATION_PENDING** until each platform row below has dated evidence. This checklist does **not** qualify a platform by itself — it is the procedure for producing evidence.

Branch / build under test: record commit SHA and build date at top of each run sheet.

## Shared setup

1. Serve the SPE web app (local `npm run build && npm run preview`, or a staging host that is **not** the parked apex).
2. Open **Create → Speech**.
3. Confirm visitor copy shows implementation-present / device-qualification-pending honesty (no “on-device ASR” claim).
4. Prepare a quiet room; use the device’s built-in or attached microphone.
5. Capture: browser name+version, OS version, date/time (IST), pass/fail per step, screenshots or short screen recording if useful.
6. Privacy note: browser speech may leave the device. SPE does not store audio.

## Matrix to fill

| Platform | Browser | API present? | Mic allow | Mic deny | Start/stop | Edit transcript | Mixed speech+typing | Mic cleanup | Dictation smoke | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop | Chrome | | | | | | | | | NOT_TESTED |
| Desktop | Safari | | | | | | | | | NOT_TESTED |
| Android | Chrome | | | | | | | | | NOT_TESTED |
| iPhone | Safari | | | | | | | | | NOT_TESTED |

Mark a row **QUALIFIED** only if every required step below is PASS on that device.

## Steps (repeat per platform × browser)

### A. Permission allow
1. With mic permission not yet granted, open Speech panel.
2. Tick “Allow browser speech recognition for this session”.
3. Click **Start microphone**.
4. When the browser prompts, **Allow**.
5. PASS if listening state appears and no permission-denied alert.

### B. Permission deny
1. Reset site permissions (browser site settings → Microphone → Block) or use a fresh profile.
2. Start microphone; choose **Block**.
3. PASS if a clear human-language alert appears (permission denied) and the UI does not claim it is listening.

### C. Start / stop
1. Allow mic; Start; speak a short sentence; Stop.
2. PASS if listening starts and stops cleanly; Stop works without reload.

### D. Edit transcript
1. After speech, edit the transcript textarea by hand.
2. PASS if edits stick and **Add transcript to idea** inserts the edited text.

### E. Mixed speech + typing
1. Speak a phrase; Stop; type additional words into the same transcript; Add to idea.
2. PASS if both spoken and typed content reach the idea field.

### F. Mic cleanup
1. Start listening; navigate away from Create (or close the Speech details) without Stop.
2. PASS if mic indicator clears / no stuck listening (OS mic light off within a few seconds).

### G. Dictation smoke
1. Speak a known phrase (e.g. “Schedule a team sync tomorrow at ten”).
2. PASS if transcript is roughly correct (≥70% of words recognizable) in the review box.

## Box / CI limitation (do not override)

Linux agent / headless Chromium: API may be present; fake mic may grant; **dictation often FAIL (`audio-capture`)**. That is **IMPLEMENTATION_PRESENT**, never QUALIFIED.

## Evidence pack to attach

- Filled matrix table (this file or a dated copy under `proofs/spe_v1_launch/speech_runs/YYYYMMDD/`)
- Browser/OS versions
- Commit SHA tested
- Optional screenshots of allow/deny/transcript

## After founder runs

Update `apps/web/src/engine/speechQualification.ts` rows only when evidence exists. Do not mark READY/QUALIFIED without a dated run sheet.
