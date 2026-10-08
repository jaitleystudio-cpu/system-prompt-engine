"""SPE-R9S hardening — decode-window seam integrity.

Long audio is decoded in windows cut at quiet points; in dense speech a cut can
still land inside a word. Each decoded span therefore overlaps its neighbours
by DECODE_WINDOW_OVERLAP_MS on both sides and per-window transcripts are
reconciled at the seam. These tests pin: no lost boundary words, no
window-caused duplicates, order preserved, Unicode intact, and (on real local
inference, skipped without the pack) forced mid-word cuts that previously lost
or garbled words now reproduce the uncut transcript.

Audio provenance: repository fixtures under apps/web/scripts/fixtures/media
(te_long_pcm16.wav has a human-written reference te_long.ref.txt).
"""

from __future__ import annotations

import array
import unicodedata
import wave
from pathlib import Path

import pytest

import spe_runtime.media_product.local_backend as lb
from spe_runtime.media_product.local_backend import (
    DECODE_WINDOW_MAX_MS,
    DECODE_WINDOW_OVERLAP_MS,
    IntegrityError,
    LocalMediaSession,
    decode_spans,
    discover_qualified_assets,
    merge_window_transcripts,
    plan_decode_windows,
)

SR = 16000
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "apps" / "web" / "scripts" / "fixtures" / "media"


def _read(path: Path) -> "array.array[int]":
    with wave.open(str(path), "rb") as handle:
        raw = handle.readframes(handle.getnframes())
    data = array.array("h")
    data.frombytes(raw)
    return data


# ------------------------------------------------------------ reconciliation (pure)

def test_shared_overlap_words_kept_once_in_order():
    assert merge_window_transcripts(["a b c d e", "d e f g"]) == "a b c d e f g"
    assert merge_window_transcripts(["a b c", "b c d e", "d e f"]) == "a b c d e f"


def test_cut_off_fragments_at_window_edges_are_replaced_by_full_words():
    left = "నమస్కారం నా పేరు గీత ఈరోజు వాతా"
    right = "గీ ఈరోజు వాతావరణం చాలా బాగుంది"
    assert merge_window_transcripts([left, right]) == "నమస్కారం నా పేరు గీత ఈరోజు వాతావరణం చాలా బాగుంది"


def test_truncated_left_copy_inside_shared_run_prefers_complete_word():
    left = "నా పేరు గీత ఈరోజు వాతావరణ"
    right = "గీత ఈరోజు వాతావరణం చాలా"
    assert merge_window_transcripts([left, right]) == "నా పేరు గీత ఈరోజు వాతావరణం చాలా"


def test_genuine_repetition_across_seam_is_not_deduplicated():
    assert merge_window_transcripts(["నమస్కారం నమస్కారం నా", "నమస్కారం నా పేరు"]) == "నమస్కారం నమస్కారం నా పేరు"


def test_no_shared_words_means_plain_ordered_join():
    assert merge_window_transcripts(["one two", "three four", "", "five"]) == "one two three four five"


def test_reconciliation_output_is_nfc_and_free_of_replacement_chars():
    decomposed = unicodedata.normalize("NFD", "గీత ఈరోజు")
    merged = merge_window_transcripts([decomposed, "ఈరోజు వాతావరణం"])
    assert unicodedata.is_normalized("NFC", merged) and "\ufffd" not in merged
    assert merged == "గీత ఈరోజు వాతావరణం"


# ------------------------------------------------------------ decode spans

@pytest.mark.parametrize("name", ["te_dengue_intro_30s.wav", "en_jfk_human.wav", "hi_dengue_intro_30s.wav"])
def test_decode_spans_overlap_every_seam_and_stay_within_budget(name: str):
    samples = _read(FIXTURES_DIR / name)
    windows = plan_decode_windows(samples)
    spans = decode_spans(windows, len(samples))
    pad = SR * DECODE_WINDOW_OVERLAP_MS // 1000
    assert len(spans) == len(windows) >= 2
    assert spans[0][0] == 0 and spans[-1][1] == len(samples)
    for (core_end, (span_a, span_b)) in zip([w[1] for w in windows[:-1]], zip(spans, spans[1:])):
        assert span_a[1] >= min(len(samples), core_end + pad) and span_b[0] <= core_end - pad
    for start, end in spans:
        assert end - start <= SR * (DECODE_WINDOW_MAX_MS + 2 * DECODE_WINDOW_OVERLAP_MS) // 1000


def test_single_window_audio_has_no_overlap_span():
    samples = _read(FIXTURES_DIR / "te_long_pcm16.wav")
    assert decode_spans(plan_decode_windows(samples), len(samples)) == [(0, len(samples))]


# ------------------------------------------------------------ real local inference

@pytest.fixture(scope="module")
def session():
    try:
        assets = discover_qualified_assets()
    except IntegrityError as exc:
        if "UNSUPPORTED_ARCHITECTURE" in str(exc) or "PINNED_ASSET_NOT_ON_DISK" in str(exc):
            pytest.skip(f"Local media backend requires macOS arm64: {exc}")
        raise
    sess = LocalMediaSession.open(assets, language="te")
    yield sess
    sess.close()


# Cut positions inside words where the un-overlapped decode lost "గీత" (1.5 s),
# garbled "పేరు గీత" (1.8 s), dropped "చాలా" (3.0 s) or hallucinated a tail (3.6 s).
@pytest.mark.parametrize("cut_s", [1.5, 1.8, 3.0, 3.6])
def test_forced_mid_word_cut_reproduces_uncut_transcript(session, monkeypatch, cut_s: float):
    path = FIXTURES_DIR / "te_long_pcm16.wav"
    uncut = session.transcribe_path(path).text
    cut = int(cut_s * SR)
    monkeypatch.setattr(lb, "plan_decode_windows", lambda samples, sr=16000: [(0, cut), (cut, len(samples))])
    forced = session.transcribe_path(path)
    assert forced.status == "SPEECH"
    assert forced.text.replace(" ", "") == uncut.replace(" ", ""), (uncut, forced.text)
    assert session.temp_files_remaining == 0
