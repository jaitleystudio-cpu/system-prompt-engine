"""R8 copy must describe the implemented surface, not planned capabilities."""
import pytest
from tests.web.paths import WEB

@pytest.mark.parametrize('file,unsupported', [
    ('builder/StaticWebsiteBuilder.tsx', 'Desktop (1200px)'),
    ('builder/websiteSpecModel.ts', 'Download self-contained offline HTML and CSS bundles directly to your machine.'),
    ('landing/UniversalInputShell.tsx', 'Maximum file size 50MB.'),
    ('landing/UniversalInputShell.tsx', 'Synthesize production-ready source code'),
    ('landing/UniversalInputShell.tsx', 'Transcribe audio & video into structured transcript'),
    ('landing/UniversalInputShell.tsx', 'Generate project architecture & implementation'),
    ('landing/UniversalInputShell.tsx', 'Conduct empirical investigation & citation search'),
    ('landing/UniversalInputShell.tsx', 'Produce visual assets & creative media'),
    ('landing/ModalModeSelector.tsx', 'Optimal balance of precision, reasoning depth, and synthesis speed.'),
    ('landing/ModalModeSelector.tsx', 'Multi-layered reasoning and systematic requirement expansion for complex workflows.'),
    ('landing/ModalModeSelector.tsx', 'Rapid turnaround for live experimentation and rapid specification prototyping.'),
    ('landing/ModalModeSelector.tsx', 'Enforces strict output contracts, schema guarantees, and verifiable boundaries.'),
])
def test_unimplemented_surface_claims_are_absent(file, unsupported):
    assert unsupported not in (WEB / 'src' / file).read_text()

@pytest.mark.parametrize('file,unsupported', [
    ('media/MediaProductPanel.tsx', 'It is not uploaded.'),
    ('media/MediaProductPanel.tsx', 'The shell still has to mount this panel.'),
    ('media/pinnedWhisperRuntime.ts', 'Starting the local media session on this machine.'),
    ('media/OcrRoute.tsx', 'The pinned engine reads it on this machine.'),
    ('media/VisualScreenshotWorkspace.tsx', 'Click or drop UI screenshot here'),
    ('media/VisualScreenshotWorkspace.tsx', 'The synthesizer extracts layout hierarchy, colors, typography, and interactive controls.'),
])
def test_media_copy_does_not_imply_unproven_processing(file, unsupported):
    assert unsupported not in (WEB / 'src' / file).read_text()


def test_project_library_sample_does_not_claim_measured_verification():
    text = (WEB / "src" / "library" / "projectLibraryModel.ts").read_text()
    assert "complete, fully verified spe.project-library.v1 sample bundle" not in text
    assert "ev:cwv_lcp_verified" not in text
    assert "ev:syntax_validation_pass" not in text
    assert "prov:eval_delta_pass" not in text
    assert "ev:typecheck_pass" not in text
    assert "Synthetic schema fixture" in text

@pytest.mark.parametrize('file,unsupported', [
    ('routing.ts', 'Media is not mounted in this build.'),
    ('routing.ts', 'Read text from an image on this machine with the pinned local engine.'),
    ('website/WebsiteProduct.tsx', 'Shell mount: not done.'),
    ('research/ResearchRoute.tsx', 'I consent to a public research lookup. Off means no search.'),
])
def test_mounted_routes_describe_actual_request_behavior(file, unsupported):
    assert unsupported not in (WEB / 'src' / file).read_text()


def test_website_mount_truth_matches_live_shell():
    app = (WEB / "src" / "App.tsx").read_text()
    ledger = (WEB / "src" / "shell" / "mountStatus.ts").read_text()
    flow = (WEB / "src" / "website" / "productFlow.ts").read_text()
    contract = (WEB / "src" / "website" / "mount-contract.ts").read_text()

    assert "<WebsiteProduct />" in app
    assert 'WEBSITE_PRODUCT: "MOUNTED_LOCAL"' in ledger
    assert 'SHELL_MOUNT = "NOT_DONE"' not in flow
    assert 'ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"' not in flow
    assert 'routeMountStatus: "NOT_INTEGRATED"' not in contract
    assert 'shellMount: "NOT_DONE"' not in contract
    assert 'status: "READY_FOR_SHELL_MOUNT"' not in contract
    assert 'SHELL_MOUNT = "MOUNTED"' in flow
    assert 'ROUTE_MOUNT_STATUS = "MOUNTED"' in flow
    assert 'routeMountStatus: "MOUNTED"' in contract
    assert 'shellMount: "MOUNTED"' in contract
