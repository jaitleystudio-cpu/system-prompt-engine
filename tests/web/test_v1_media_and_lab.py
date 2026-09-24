"""SPE Website V1 — media helpers + Daily Lab + P0 behavioral gates."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web" / "src"
APP = WEB / "App.tsx"
COMPOSER = WEB / "composer" / "UnifiedComposer.tsx"


def test_media_modules_exist_and_forbid_paid_proxy():
    media = WEB / "media"
    assert (media / "imageObserve.ts").is_file()
    assert (media / "videoSample.ts").is_file()
    assert (media / "screenshotToCode.ts").is_file()
    assert (media / "urlIngest.ts").is_file()
    assert (media / "untrusted.ts").is_file()
    assert (media / "limits.ts").is_file()
    assert (media / "semanticPipeline.ts").is_file()
    assert (media / "uiObservation.ts").is_file()
    assert (WEB / "engine" / "visionBudget.ts").is_file()
    blob = "\n".join(p.read_text(encoding="utf-8") for p in media.glob("*.ts"))
    for banned in ("corsproxy", "allorigins", "scrapingbee", "zenrows", "api.openai", "openai.com/v1"):
        assert banned not in blob.lower()
    assert "proxy" in blob.lower()


def test_screenshot_targets_include_six_frameworks_with_human_labels():
    text = (WEB / "media" / "screenshotToCode.ts").read_text(encoding="utf-8")
    for token in ("html-css-js", "react", "swiftui", "compose", "flutter", "react-native"):
        assert token in text
    assert "CODE_TARGET_LABELS" in text
    assert "HTML / CSS / JavaScript" in text
    assert "Jetpack Compose" in text
    assert "React Native" in text
    assert "UIObservationIR" in text or "screenshotIRToCodePackage" in text


def test_daily_lab_is_premium_3d_with_finite_queue():
    specimens = (WEB / "lab" / "specimens.ts").read_text(encoding="utf-8")
    assert "DAILY_3D_QUEUE" in specimens
    assert specimens.count('id: "d3d-') == 14
    assert "DAILY_QUEUE_DAYS" in specimens
    assert "publishDate" in specimens
    assert "buildPrompt" in specimens
    assert "speArtifact" in specimens
    assert "interaction" in specimens
    lab = (WEB / "lab" / "DailyLab.tsx").read_text(encoding="utf-8")
    assert "Same date, same set" not in lab
    assert "PRODUCT_DIRECTION_MISMATCH" not in lab
    assert "FINITE_QUEUE" in lab
    assert "Daily 3D Lab" in lab
    assert "LabStage" in lab
    assert (WEB / "lab" / "PromptGallery.tsx").is_file()
    gallery = (WEB / "lab" / "gallery" / "promptGallery.ts").read_text(encoding="utf-8")
    assert gallery.count('id: "gal-') >= 30


def test_unified_composer_and_nav_surfaces():
    composer = COMPOSER.read_text(encoding="utf-8")
    for mode in ('"text"', '"speech"', '"image"', '"screenshot"', '"video"', '"url"'):
        assert mode in composer
    assert "observeImageFileSemantic" in composer
    assert "observeScreenshotIR" in composer
    assert "initialMode" in composer
    nav = (WEB / "layout" / "Nav.tsx").read_text(encoding="utf-8")
    for label in ("Home", "Create", "Code", "Daily Lab", "My Work", "Privacy / Proof"):
        assert label in nav
    assert "Build my prompt" in nav


def test_human_cta_build_my_prompt():
    copy = (REPO / "packages" / "human-perspective" / "src" / "copy.ts").read_text(encoding="utf-8")
    assert 'build: "Build my prompt"' in copy
    assert "Start with an idea" in copy
    assert "There's more in your idea" in copy or "There is more in the idea" in copy
    assert "COMPILE INTENT" not in copy
    assert "RAW THOUGHT" not in copy


def test_headers_file_documents_csp():
    headers = REPO / "apps" / "web" / "public" / "_headers"
    assert headers.is_file()
    text = headers.read_text(encoding="utf-8")
    assert "Content-Security-Policy" in text
    assert "frame-ancestors" in text
    assert "X-Content-Type-Options" in text
    assert "Referrer-Policy" in text


def test_intent_provenance_auto_vs_user_edited():
    text = APP.read_text(encoding="utf-8")
    assert "AUTO_DERIVED_INTENT" in text
    assert "USER_EDITED_INTENT" in text
    assert "applyUserRequestChange" in text
    assert "shouldPreserveEditedIntent" in text
    assert "mapLabCategory" in text
    # Daily Lab clean open
    assert "setIntent(defaultIntentLens" in text
    assert "setCategory(mapLabCategory(s.category))" in text
    assert 'setMode("simple")' in text
    assert "buildPrompt" in text


def test_composer_async_race_and_mode_cleanup():
    text = COMPOSER.read_text(encoding="utf-8")
    assert "valueRef" in text
    assert "opIdRef" in text
    assert "AbortController" in text
    assert "clearModeSpecificState" in text
    assert "revokeObjectURL" in text
    assert "isCurrent" in text
    # URL failures must not append
    assert "Nothing was added to your idea" in text
    assert "urlResultToPromptBlock(result)" in text


def test_clipboard_await_real_success():
    app = APP.read_text(encoding="utf-8")
    assert "await navigator.clipboard.writeText" in app
    composer = COMPOSER.read_text(encoding="utf-8")
    assert "await navigator.clipboard.writeText" in composer
    assert "Copy unavailable" in composer


def test_spe_extension_not_spe_json_mismatch():
    app = APP.read_text(encoding="utf-8")
    assert "artifact-${Date.now()}.spe`" in app or '`.spe`' in app or ".spe`" in app
    assert "artifact-${Date.now()}.spe.json" not in app
    ws = (WEB / "workspace" / "Workspace.tsx").read_text(encoding="utf-8")
    assert ".spe" in ws
    assert 'accept=".spe' in ws


def test_url_bounded_stream_and_untrusted_boundary():
    url = (WEB / "media" / "urlIngest.ts").read_text(encoding="utf-8")
    assert "readResponseBounded" in url
    assert "MAX_URL_BYTES" in url
    assert "finalUrl" in url
    assert "urlResultToPromptBlock" in url
    assert "return null" in url
    assert "Website X-Ray" in url or "Landmarks" in url
    assert "script tags (not executed)" in url or "were not executed" in url
    unt = (WEB / "media" / "untrusted.ts").read_text(encoding="utf-8")
    assert "UNTRUSTED_SOURCE" in unt
    assert "DATA TO ANALYZE" in unt
    assert "wrapUntrustedData" in unt


def test_media_bounds_before_decode_and_source_dims():
    limits = (WEB / "media" / "limits.ts").read_text(encoding="utf-8")
    assert "assertImageFileBounds" in limits
    assert "assertVideoFileBounds" in limits
    assert "MAX_IMAGE_MEGAPIXELS" in limits
    img = (WEB / "media" / "imageObserve.ts").read_text(encoding="utf-8")
    assert "sourceWidth" in img
    assert "sourceHeight" in img
    assert "assertImageFileBounds" in img
    # alpha consistency on grid
    assert "pixels[i + 3] < 16" in img


def test_screenshot_code_target_single_canonical_state():
    text = COMPOSER.read_text(encoding="utf-8")
    assert "applyCodeTarget" in text
    assert "CODE_TARGET_LABELS" in text


def test_vision_budget_zero_until_standard():
    vb = (WEB / "engine" / "visionBudget.ts").read_text(encoding="utf-8")
    assert "getVisionModelBytes" in vb
    assert "VISION_PACK_DOCS" in vb
    assert "homepageBytes: 0" in vb
    models = REPO / "apps" / "web" / "public" / "models" / "LICENSE.md"
    assert models.is_file()
    assert "Apache-2.0" in models.read_text(encoding="utf-8")


def test_speech_qualification_matrix_honest():
    path = WEB / "engine" / "speechQualification.ts"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "NOT_TESTED" in text
    assert "on-device" in text.lower() or "on-device" in (WEB / "input" / "SpeechInput.tsx").read_text().lower()
    assert "SPEECH_QUALIFICATION_MATRIX" in text


def test_code_nav_defaults_to_screenshot_mode():
    app = APP.read_text(encoding="utf-8")
    assert 'initialMode={view === "code" ? "screenshot" : "text"}' in app
