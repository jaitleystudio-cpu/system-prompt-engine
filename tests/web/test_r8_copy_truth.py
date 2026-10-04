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
