"""Read-only Accessibility R1 laws for the Lane G donor.

This module reads the donor tree. It does not modify runtime, CSS, or the
donor harness. A non-empty qualify() result means a claim exceeded the
evidence. Automated checks are not a human screen-reader session.
UNKNOWN is not PASS. No WCAG certificate is issued here.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace
from pathlib import Path

DONOR_SHA = "3a04d7fb99ed6967995073d1c26661008f52ab93"
DONOR_BRANCH = "antigravity/spe-accessibility-v1-20260930"
MUTANT_IDS = tuple(f"A11Y1-{index:02d}" for index in range(1, 21))

_FOCUSABLE_HIDDEN = re.compile(
    r"<(button|a|input|select|textarea|summary)\b[^>]*\baria-hidden\s*=\s*['\"]true['\"][^>]*>",
    re.IGNORECASE,
)
_BURGER_BUTTON = re.compile(r"<button\b[^>]*spe-nav-burger[^>]*>", re.DOTALL)
_BURGER_DIV = re.compile(r"<div\b[^>]*spe-nav-burger[^>]*>", re.DOTALL)
_SKIP_TARGET_OUTLINE = re.compile(
    r"main:focus\s*,\s*\.studio-output:focus\s*\{[^}]*outline:\s*none",
    re.DOTALL,
)
_HTML_LANG = re.compile(r"<html\b[^>]*\blang\s*=\s*['\"]en['\"]", re.IGNORECASE)
_ZOOM_LOCK = re.compile(r"user-scalable\s*=\s*no|maximum-scale\s*=\s*1", re.IGNORECASE)


@dataclass(frozen=True)
class Observation:
    """Facts read from the donor, plus flags a mutant may inject."""

    skip_link_present: bool
    skip_link_tested: bool
    main_landmark: bool
    escape_closes_menu: bool
    escape_tested: bool
    keyboard_trap_session: bool
    trap_injected: bool
    focus_visible_dark: bool
    focus_visible_light: bool
    focus_rings_tested: bool
    skip_target_outline_none: bool
    contrast_measured: bool
    contrast_ratio_invented: bool
    reduced_motion_css_present: bool
    reduced_motion_css_tested: bool
    reduced_motion_effect_tested: bool
    reduced_motion_ignored: bool
    zoom_reflow_measured: bool
    zoom_locked: bool
    harness_claims_zoom: bool
    harness_claims_wcag_complete: bool
    aria_hidden_focusable: bool
    heading_order_audited: bool
    accessible_name_missing: bool
    unlabeled_control: bool
    human_sr_performed: bool
    fabricated_sr_session: bool
    language_present: bool
    menu_control: str
    autoplay_gate_present: bool
    autoplay_ignores_reduced: bool
    live_region_present: bool
    live_region_tested: bool
    error_sr_verified: bool


@dataclass(frozen=True)
class Claim:
    """What a qualification report says. The honest claim never says PASS."""

    skip_link: str
    keyboard_escape: str
    keyboard_trap: str
    focus_rings: str
    focus_skip_target: str
    focus_retained: str
    contrast: str
    reduced_motion_css: str
    reduced_motion_effect: str
    reflow_zoom: str
    live_region: str
    error_announced: str
    language: str
    heading_order: str
    human_screen_reader: str
    wcag_certificate: str
    wcag_level: str
    semantic_authority: str
    aria_hidden_focusable: str
    menu_control: str
    autoplay: str
    accessible_name: str
    control_name: str
    harness_log_is_certificate: bool
    audit_complete: bool


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _tsx_sources(src: Path) -> str:
    parts: list[str] = []
    for path in sorted(src.rglob("*")):
        if path.suffix in {".ts", ".tsx"} and "node_modules" not in path.parts:
            parts.append(_read(path))
    return "\n".join(parts)


def observe(repo: Path) -> Observation:
    """Read the donor accessibility surface. Mutant-only flags stay false."""
    web = repo / "apps" / "web"
    css = _read(web / "src" / "index.css")
    app = _read(web / "src" / "App.tsx")
    nav = _read(web / "src" / "layout" / "Nav.tsx")
    html = _read(web / "index.html")
    workspace = _read(web / "src" / "workspace" / "Workspace.tsx")
    hero_story = _read(web / "src" / "landing" / "HeroStory.tsx")
    theme = _read(web / "src" / "ui" / "ThemeToggle.tsx")
    harness = _read(web / "scripts" / "test-accessibility-harness.mjs")
    donor_test = _read(repo / "tests" / "web" / "test_accessibility_compliance.py")
    sources = _tsx_sources(web / "src")

    menu_control = "missing"
    if _BURGER_DIV.search(nav):
        menu_control = "div"
    elif _BURGER_BUTTON.search(nav):
        menu_control = "button"

    effect_probe = donor_test + "\n" + harness
    return Observation(
        skip_link_present=(
            'className="skip-link"' in app
            and 'href="#main"' in app
            and 'id="main"' in app
            and "tabIndex={-1}" in app
        ),
        skip_link_tested=(
            'className="skip-link"' in donor_test and 'href="#main"' in donor_test
        ),
        main_landmark='<main id="main"' in app,
        escape_closes_menu='e.key === "Escape" && p.menuOpen' in nav,
        escape_tested="Escape" in donor_test,
        keyboard_trap_session=False,
        trap_injected=False,
        focus_visible_dark=(
            "button:focus-visible" in css and "outline: 2px solid #bbceff" in css
        ),
        focus_visible_light=(
            'html[data-theme="light"] button:focus-visible' in css
            and "outline: 2px solid #1a3675" in css
        ),
        focus_rings_tested=(
            "outline: 2px solid #bbceff" in donor_test
            and "outline: 2px solid #1a3675" in donor_test
        ),
        skip_target_outline_none=_SKIP_TARGET_OUTLINE.search(css) is not None,
        contrast_measured=re.search(
            r"contrast\s*ratio|relative\s+luminance|(?:4\.5|3)\s*:\s*1",
            donor_test,
            re.IGNORECASE,
        )
        is not None,
        contrast_ratio_invented=False,
        reduced_motion_css_present=(
            "@media (prefers-reduced-motion: reduce)" in css
            and "animation-duration: 0.001ms !important" in css
            and "transition-duration: 0.001ms !important" in css
            and "scroll-behavior: auto !important" in css
        ),
        reduced_motion_css_tested=(
            "animation-duration: 0.001ms !important" in donor_test
            and "prefers-reduced-motion: reduce" in donor_test
        ),
        reduced_motion_effect_tested=(
            "getComputedStyle" in effect_probe or "emulateMedia" in effect_probe
        ),
        reduced_motion_ignored=False,
        zoom_reflow_measured=("scrollWidth" in effect_probe and "320" in effect_probe),
        zoom_locked=_ZOOM_LOCK.search(html) is not None,
        harness_claims_zoom="200% zoom" in harness,
        harness_claims_wcag_complete=(
            "ALL WCAG 2.1 AA ACCESSIBILITY AUDIT CHECKS PASSED" in harness
        ),
        aria_hidden_focusable=_FOCUSABLE_HIDDEN.search(sources) is not None,
        heading_order_audited=False,
        accessible_name_missing="aria-label" not in theme,
        unlabeled_control=False,
        human_sr_performed=False,
        fabricated_sr_session=False,
        language_present=_HTML_LANG.search(html) is not None,
        menu_control=menu_control,
        autoplay_gate_present=(
            "if (reduced || paused || !visible || done) return;" in hero_story
            and "if (reduced) return;" in hero_story
        ),
        autoplay_ignores_reduced=False,
        live_region_present=(
            'role="status"' in workspace and 'aria-live="polite"' in workspace
        ),
        live_region_tested=(
            'role="status"' in harness and 'aria-live="polite"' in harness
        ),
        error_sr_verified=False,
    )


def hold_gaps(obs: Observation) -> tuple[str, ...]:
    """Donor facts that contradict the boundaries this SHA actually ships."""
    gaps: list[str] = []
    if not obs.skip_link_present or not obs.main_landmark:
        gaps.append("DONOR_SKIP_LINK_MISSING")
    if not obs.skip_link_tested:
        gaps.append("DONOR_SKIP_LINK_UNTESTED")
    if not obs.escape_closes_menu:
        gaps.append("DONOR_ESCAPE_MISSING")
    if not (obs.focus_visible_dark and obs.focus_visible_light and obs.focus_rings_tested):
        gaps.append("DONOR_FOCUS_RING_MISSING")
    if not obs.skip_target_outline_none:
        gaps.append("DONOR_SKIP_TARGET_OUTLINE_UNEXPECTED")
    if not obs.reduced_motion_css_present or not obs.reduced_motion_css_tested:
        gaps.append("DONOR_REDUCED_MOTION_CSS_MISSING")
    if obs.reduced_motion_effect_tested:
        gaps.append("DONOR_REDUCED_MOTION_EFFECT_UNDECLARED")
    if obs.zoom_reflow_measured:
        gaps.append("DONOR_ZOOM_MEASUREMENT_UNDECLARED")
    if obs.zoom_locked:
        gaps.append("DONOR_ZOOM_LOCKED")
    if not obs.harness_claims_zoom or not obs.harness_claims_wcag_complete:
        gaps.append("DONOR_HARNESS_OVERCLAIM_REMOVED")
    if obs.aria_hidden_focusable:
        gaps.append("DONOR_ARIA_HIDDEN_ON_FOCUSABLE")
    if obs.menu_control != "button":
        gaps.append("DONOR_MENU_NOT_BUTTON")
    if not obs.language_present:
        gaps.append("DONOR_LANGUAGE_MISSING")
    if not obs.autoplay_gate_present:
        gaps.append("DONOR_AUTOPLAY_UNGATED")
    if not obs.live_region_present or not obs.live_region_tested:
        gaps.append("DONOR_LIVE_REGION_MISSING")
    if obs.human_sr_performed or obs.keyboard_trap_session or obs.heading_order_audited:
        gaps.append("DONOR_HUMAN_OR_TRAP_SESSION_FABRICATED")
    if obs.contrast_measured or obs.accessible_name_missing:
        gaps.append("DONOR_CONTRAST_OR_NAME_FACT_CHANGED")
    return tuple(gaps)


def honest_claim(obs: Observation) -> Claim:
    """The only claim this lane will stand behind for the current observation."""
    focus_ready = obs.focus_visible_dark and obs.focus_visible_light and obs.focus_rings_tested
    return Claim(
        skip_link=(
            "STATIC_ASSERTED"
            if obs.skip_link_present and obs.skip_link_tested
            else "MISSING"
        ),
        keyboard_escape="SOURCE_PRESENT" if obs.escape_closes_menu else "MISSING",
        keyboard_trap="UNKNOWN",
        focus_rings="STATIC_ASSERTED" if focus_ready else "MISSING",
        focus_skip_target="NOT_VISIBLE" if obs.skip_target_outline_none else "UNKNOWN",
        focus_retained="NOT_CLAIMED",
        contrast="UNMEASURED",
        reduced_motion_css=(
            "STATIC_ASSERTED"
            if obs.reduced_motion_css_present and obs.reduced_motion_css_tested
            else "MISSING"
        ),
        reduced_motion_effect="UNKNOWN",
        reflow_zoom="NOT_EVIDENCED",
        live_region=(
            "STATIC_ASSERTED"
            if obs.live_region_present and obs.live_region_tested
            else "MISSING"
        ),
        error_announced="UNKNOWN",
        language="SOURCE_PRESENT" if obs.language_present else "MISSING",
        heading_order="UNKNOWN",
        human_screen_reader="NOT_PERFORMED",
        wcag_certificate="NOT_A_CERTIFICATE",
        wcag_level="NOT_CERTIFIED",
        semantic_authority="NONE",
        aria_hidden_focusable="FOUND" if obs.aria_hidden_focusable else "NONE_OBSERVED",
        menu_control="NATIVE_BUTTON" if obs.menu_control == "button" else "MISSING",
        autoplay=(
            "GATED_IN_SOURCE_UNTESTED"
            if obs.autoplay_gate_present and not obs.autoplay_ignores_reduced
            else "UNKNOWN"
        ),
        accessible_name="MISSING" if obs.accessible_name_missing else "SOURCE_PRESENT",
        control_name="NOT_EXHAUSTIVE",
        harness_log_is_certificate=False,
        audit_complete=False,
    )


def _mark(found: set[str], code: str) -> None:
    found.add(code)


def qualify(obs: Observation, claim: Claim) -> set[str]:
    """Return every mutant law the claim violates. Empty means fail-closed."""
    found: set[str] = set()
    focus_css = obs.focus_visible_dark and obs.focus_visible_light
    if (
        claim.focus_rings == "PASS"
        or claim.focus_skip_target == "PASS"
        or claim.focus_retained == "PASS"
        or (obs.skip_target_outline_none and claim.focus_retained == "PASS")
        or (not focus_css and claim.focus_rings in {"PASS", "STATIC_ASSERTED"})
    ):
        _mark(found, "A11Y1-01")
    if obs.trap_injected and claim.keyboard_trap in {"PASS", "ACCEPTED"}:
        _mark(found, "A11Y1-02")
    if not obs.skip_link_present and claim.skip_link in {"PASS", "STATIC_ASSERTED"}:
        _mark(found, "A11Y1-03")
    if obs.unlabeled_control and claim.control_name == "PASS":
        _mark(found, "A11Y1-04")
    if claim.contrast in {"PASS", "AA", "AAA"} or obs.contrast_ratio_invented:
        _mark(found, "A11Y1-05")
    if (not obs.reduced_motion_css_present and claim.reduced_motion_css == "STATIC_ASSERTED") or (
        obs.reduced_motion_ignored and claim.reduced_motion_effect != "REFUSED"
    ):
        _mark(found, "A11Y1-06")
    if not obs.zoom_reflow_measured and claim.reflow_zoom in {"PASS", "VERIFIED"}:
        _mark(found, "A11Y1-07")
    if obs.aria_hidden_focusable and claim.aria_hidden_focusable in {
        "PASS",
        "NONE_OBSERVED",
        "ACCEPTED",
    }:
        _mark(found, "A11Y1-08")
    if not obs.heading_order_audited and claim.heading_order in {"PASS", "VALID"}:
        _mark(found, "A11Y1-09")
    if obs.accessible_name_missing and claim.accessible_name in {"PASS", "SOURCE_PRESENT"}:
        _mark(found, "A11Y1-10")
    if claim.error_announced in {"COMPLETE", "PASS"} and not obs.error_sr_verified:
        _mark(found, "A11Y1-11")
    if obs.autoplay_ignores_reduced and claim.autoplay in {
        "PASS",
        "GATED_IN_SOURCE_UNTESTED",
    }:
        _mark(found, "A11Y1-12")
    if obs.menu_control != "button" and claim.menu_control in {"PASS", "NATIVE_BUTTON"}:
        _mark(found, "A11Y1-13")
    if not obs.language_present and claim.language in {"PASS", "SOURCE_PRESENT"}:
        _mark(found, "A11Y1-14")
    if claim.human_screen_reader in {"PASS", "PERFORMED"} or obs.fabricated_sr_session:
        _mark(found, "A11Y1-15")
    if (
        not obs.keyboard_trap_session
        and not obs.trap_injected
        and claim.keyboard_trap == "PASS"
    ):
        _mark(found, "A11Y1-16")
    if claim.semantic_authority != "NONE":
        _mark(found, "A11Y1-17")
    if claim.wcag_level in {"AAA", "AA"}:
        _mark(found, "A11Y1-18")
    if claim.harness_log_is_certificate or claim.wcag_certificate in {"PASS", "CERTIFIED"}:
        _mark(found, "A11Y1-19")
    if claim.audit_complete and claim.human_screen_reader == "NOT_PERFORMED":
        _mark(found, "A11Y1-20")
    return found


def _mutant_focus_lost(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, focus_retained="PASS")


def _mutant_trap_accepted(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, trap_injected=True), replace(claim, keyboard_trap="PASS")


def _mutant_skip_removed(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, skip_link_present=False), claim


def _mutant_unlabeled(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, unlabeled_control=True), replace(claim, control_name="PASS")


def _mutant_contrast(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, contrast_ratio_invented=True), replace(claim, contrast="AAA")


def _mutant_motion_ignored(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return (
        replace(obs, reduced_motion_css_present=False, reduced_motion_ignored=True),
        claim,
    )


def _mutant_reflow(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, reflow_zoom="PASS")


def _mutant_aria_hidden(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, aria_hidden_focusable=True), claim


def _mutant_headings(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, heading_order="PASS")


def _mutant_name_missing(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, accessible_name_missing=True), replace(
        claim, accessible_name="PASS"
    )


def _mutant_error_complete(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, error_announced="COMPLETE")


def _mutant_autoplay(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, autoplay_ignores_reduced=True), replace(claim, autoplay="PASS")


def _mutant_div_button(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, menu_control="div"), replace(claim, menu_control="PASS")


def _mutant_language(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, language_present=False), replace(claim, language="PASS")


def _mutant_sr_session(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return replace(obs, fabricated_sr_session=True), replace(
        claim, human_screen_reader="PERFORMED"
    )


def _mutant_unknown_pass(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, keyboard_trap="PASS")


def _mutant_authority(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, semantic_authority="WCAG_AA")


def _mutant_aaa(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, wcag_level="AAA")


def _mutant_harness(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(
        claim, harness_log_is_certificate=True, wcag_certificate="PASS"
    )


def _mutant_audit_complete(obs: Observation, claim: Claim) -> tuple[Observation, Claim]:
    return obs, replace(claim, audit_complete=True)


MUTANTS = {
    "A11Y1-01": _mutant_focus_lost,
    "A11Y1-02": _mutant_trap_accepted,
    "A11Y1-03": _mutant_skip_removed,
    "A11Y1-04": _mutant_unlabeled,
    "A11Y1-05": _mutant_contrast,
    "A11Y1-06": _mutant_motion_ignored,
    "A11Y1-07": _mutant_reflow,
    "A11Y1-08": _mutant_aria_hidden,
    "A11Y1-09": _mutant_headings,
    "A11Y1-10": _mutant_name_missing,
    "A11Y1-11": _mutant_error_complete,
    "A11Y1-12": _mutant_autoplay,
    "A11Y1-13": _mutant_div_button,
    "A11Y1-14": _mutant_language,
    "A11Y1-15": _mutant_sr_session,
    "A11Y1-16": _mutant_unknown_pass,
    "A11Y1-17": _mutant_authority,
    "A11Y1-18": _mutant_aaa,
    "A11Y1-19": _mutant_harness,
    "A11Y1-20": _mutant_audit_complete,
}


MUTANT_FAULTS = {
    "A11Y1-01": "skip target keeps outline:none and focus is marked retained",
    "A11Y1-02": "injected keyboard trap marked pass",
    "A11Y1-03": "skip link removed while the static claim stays asserted",
    "A11Y1-04": "unlabeled control marked pass because some aria-label exists",
    "A11Y1-05": "contrast ratio invented and marked AAA",
    "A11Y1-06": "reduced-motion kill switch removed and the CSS claim kept",
    "A11Y1-07": "200% zoom reflow marked pass without a measurement",
    "A11Y1-08": "aria-hidden on a focusable control still reported none observed",
    "A11Y1-09": "heading order marked pass without an audit",
    "A11Y1-10": "missing accessible name marked pass",
    "A11Y1-11": "error announcement marked complete without a screen reader",
    "A11Y1-12": "story autoplay ignores reduced motion and is marked pass",
    "A11Y1-13": "menu control is a div and is marked pass",
    "A11Y1-14": "html lang removed and language marked pass",
    "A11Y1-15": "human screen-reader session fabricated",
    "A11Y1-16": "keyboard trap UNKNOWN promoted to pass",
    "A11Y1-17": "semantic authority raised to WCAG_AA",
    "A11Y1-18": "WCAG AAA certificate invented",
    "A11Y1-19": "donor harness log accepted as a WCAG certificate",
    "A11Y1-20": "audit marked complete while the human session was not performed",
}


def ledger(repo: Path) -> list[dict[str, object]]:
    obs = observe(repo)
    claim = honest_claim(obs)
    rows: list[dict[str, object]] = []
    for mutant_id in MUTANT_IDS:
        mutant_obs, mutant_claim = MUTANTS[mutant_id](obs, claim)
        codes = qualify(mutant_obs, mutant_claim)
        rows.append(
            {
                "id": mutant_id,
                "fault": MUTANT_FAULTS[mutant_id],
                "killed": mutant_id in codes,
                "codes": sorted(codes),
            }
        )
    return rows
