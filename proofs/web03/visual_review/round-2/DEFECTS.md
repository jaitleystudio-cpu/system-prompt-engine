# Visual review — round 2

Fresh browser captures:

- `desktop-hero.png` — Chrome, 1440×900.
- `mobile-hero.png` — Chrome, 390×844.
- `desktop-artifact-empty.png` — attempted direct hash navigation (capture limitation noted below).

## Improvements verified

1. **Resolved — theater color.** Graphite is now the actual canvas background; ceramic typography and warm/semantic filaments retain their intended material contrast.
2. **Resolved — desktop first viewport.** Headline, runtime ledger, composer, compile control, and scroll cue all fit at 1440×900.
3. **Resolved — mobile wash.** The 390×844 layout is dark, crisp, and contains the full composer and compile control.
4. **Pass — integrated instrument.** The composer reads as a material intake plate intersecting the raw workpiece rather than a detached generic input card.

## Remaining defects

1. **Major — mobile 3D crop.** The desktop camera start position places most filaments and gates outside the narrow portrait frustum. The mobile layout is clean but its spatial compiler is too implicit.
2. **Minor — first-act desktop gate visibility.** The hero intentionally emphasizes raw thought and first separation, but titanium structure is barely visible until the camera advances.
3. **Proof tooling — hash capture did not scroll.** Initial anchor processing occurs before the React target exists, so `desktop-artifact-empty.png` repeats the hero. This is not an application navigation defect; round 3 uses scripted `scrollIntoView` after React mount.

## Round 3 actions

- Give portrait viewports a dedicated camera start/framing so decomposition and at least one gate are visible.
- Use an instrumented browser script for real scroll, typing, compile, workspace, and Intent Lens captures.
- Reassess 320×568 separately because vertical density is highest there.
