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
import threading
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


def test_coincidental_repeat_deep_in_next_window_does_not_delete_words():
    # Observed on continuous speech: a common word ("జ్వరం") near the end of the
    # left window recurs nine words into the right window. The overlap audio sits
    # at the window edges, so that is not a seam and no right-window word may go.
    left = "డెంగ్యూ వైరస్ ఒక సాంక్రమిక ఉష్ణమండల వ్యాధి జ్వరం తలను వాయిస్"
    right = "కేసులు కొద్ది శాతం వ్యాధి రక్త శ్రావం ఫలితంగా ప్రాణహాని టెంగ్యూ జ్వరం రక్త శ్రావం"
    assert merge_window_transcripts([left, right]) == f"{left} {right}"
    assert merge_window_transcripts(["a b c x y", "p q r s x y t"]) == "a b c x y p q r s x y t"


def test_seam_run_must_start_at_right_window_edge():
    # Up to SEAM_MAX_EDGE_FRAGMENTS cut-off fragments before the run are allowed.
    assert merge_window_transcripts(["a b c d e", "q d e f"]) == "a b c d e f"
    assert merge_window_transcripts(["a b c d e", "p q d e f"]) == "a b c d e f"
    assert merge_window_transcripts(["a b c d e", "o p q d e f"]) == "a b c d e o p q d e f"


def test_repeated_phrase_across_seam_does_not_swallow_an_occurrence():
    # Observed: neighbouring windows each held the same phrase; the right window
    # also re-heard the left window's last word. Only that edge word is overlap.
    phrase = "అమ్మా నమస్కారం నా పేరు గీత ఈ రోజు వాతావరణం చాలా బాగుంది"
    assert merge_window_transcripts([phrase, f"బాగుంది {phrase}"]) == f"{phrase} {phrase}"
    assert merge_window_transcripts(["x a b c", "c a b c y"]) == "x a b c a b c y"


def test_shared_run_longer_than_overlap_can_hold_is_repetition():
    assert lb.SEAM_MAX_OVERLAP_WORDS == 6
    # Every edge-adjacent candidate here is a 7- or 8-word run: too long for
    # 1.5 s of shared audio, so the windows are joined, not collapsed.
    eight = "p q r s t u v w"
    assert merge_window_transcripts([eight, f"y {eight} z"]) == f"{eight} y {eight} z"
    six = "p q r s t u"
    assert merge_window_transcripts([f"o {six}", f"{six} z"]) == f"o {six} z"


def _offline_session(tmp_path: Path, windows, texts_by_input):
    sess = object.__new__(LocalMediaSession)
    sess._cancel_event = threading.Event()
    sess._temps = []
    sess._planned_windows = windows
    sess._planned_buf = bytearray(2 * windows[-1][1])
    sess._core_inputs = []
    sess._window_folder = tmp_path
    calls = []

    def fake_infer(first, *, no_timestamps=True, extra_inputs=()):
        paths = [first, *extra_inputs]
        calls.append([p.name for p in paths])
        if not extra_inputs:  # like whisper-cli: -otxt only with several inputs
            return texts_by_input[first.name], "", 0, True
        for path in paths:
            Path(f"{path}.txt").write_text(texts_by_input[path.name], encoding="utf-8")
        return "", "", 0, True

    sess._infer = fake_infer
    return sess, calls


def test_collapsed_overlapped_window_is_recovered_from_core_span(tmp_path: Path):
    windows = [(0, 6 * SR), (6 * SR, 12 * SR), (12 * SR, 18 * SR)]
    core = {"c001.wav": "జ్వరం తలనొప్పి కండరాలు మరియు కీళ్లనొప్పులు ఉంటాయి"}
    sess, calls = _offline_session(tmp_path, windows, core)
    texts = ["ఒకటి రెండు మూడు నాలుగు", "వాయిస్", "ఐదు ఆరు ఏడు ఎనిమిది"]
    recovered = sess._recover_collapsed_windows(texts)
    assert calls == [["c001.wav"]]  # only the collapsed window is re-decoded
    assert recovered == [texts[0], core["c001.wav"], texts[2]]
    assert all(path.parent == tmp_path for path in sess._core_inputs)


def test_several_collapsed_windows_are_recovered_in_one_decode(tmp_path: Path):
    windows = [(0, 6 * SR), (6 * SR, 12 * SR), (12 * SR, 18 * SR)]
    core = {"c000.wav": "ఒకటి రెండు మూడు నాలుగు", "c002.wav": "ఐదు ఆరు ఏడు ఎనిమిది"}
    sess, calls = _offline_session(tmp_path, windows, core)
    recovered = sess._recover_collapsed_windows(["", "తొమ్మిది పది పదకొండు పన్నెండు", "ఐదు"])
    assert calls == [["c000.wav", "c002.wav"]]
    assert recovered == [core["c000.wav"], "తొమ్మిది పది పదకొండు పన్నెండు", core["c002.wav"]]


def test_core_redecode_never_replaces_a_richer_overlapped_transcript(tmp_path: Path):
    windows = [(0, 6 * SR), (6 * SR, 12 * SR)]
    sess, calls = _offline_session(tmp_path, windows, {"c000.wav": ""})
    texts = ["అవును", "ఐదు ఆరు ఏడు ఎనిమిది"]
    assert sess._recover_collapsed_windows(texts) == texts
    assert calls == [["c000.wav"]]
    sess2, calls2 = _offline_session(tmp_path, windows, {})
    healthy = ["ఒకటి రెండు మూడు నాలుగు", "ఐదు ఆరు ఏడు ఎనిమిది"]
    assert sess2._recover_collapsed_windows(healthy) == healthy and calls2 == []


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


def _remove_long_pauses(samples: "array.array[int]") -> list[int]:
    """Continuous speech from a fixture: keep at most 60 ms of each quiet run."""
    frame = 320
    powers = [sum(x * x for x in samples[f * frame:(f + 1) * frame]) / frame for f in range(len(samples) // frame)]
    top = max(powers)
    kept: list[int] = []
    run = 0
    for f, power in enumerate(powers):
        run = run + 1 if power < top * 1e-3 else 0
        if run <= 3:
            kept.extend(samples[f * frame:(f + 1) * frame])
    return kept


def test_continuous_speech_overlap_loses_nothing_against_plain_windows(session, monkeypatch, tmp_path: Path):
    # Dense continuous speech (pauses removed) across several seams: the overlapped,
    # reconciled transcript must keep the content of the plain, un-overlapped decode.
    import difflib

    samples = _remove_long_pauses(_read(FIXTURES_DIR / "te_dengue_intro_30s.wav"))
    path = tmp_path / "continuous.wav"
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(array.array("h", samples).tobytes())
    assert len(plan_decode_windows(array.array("h", samples))) >= 3
    product = session.transcribe_path(path)
    assert product.status == "SPEECH" and session.temp_files_remaining == 0
    with monkeypatch.context() as patch:
        patch.setattr(lb, "DECODE_WINDOW_OVERLAP_MS", 0)
        patch.setattr(lb, "merge_window_transcripts", lambda texts: " ".join(t for t in texts if t))
        plain = session.transcribe_path(path).text
    a, b = plain.replace(" ", ""), product.text.replace(" ", "")
    matched = sum(m.size for m in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks())
    assert matched / len(a) >= 0.9, (plain, product.text)
    assert "\ufffd" not in product.text and unicodedata.is_normalized("NFC", product.text)
