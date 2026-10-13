"""Round 8 (Bro round-7 falsification @ f5dcaa56).
1. Greek lower-case look-alikes with no ASCII target in the vendored UTS #39 map are folded (kappa, chi, epsilon,
   eta, tau, omega, mu, beta, final/lunate sigma). Bro's "\u03baeep", "e\u03c7act", "e\u03c7actly" are refused.
2. SCOPE_BOUNDARY_v3 deduplicated re-analysis recomputes byte-identically (v3 numbers untouched)."""
import pathlib
import subprocess
import sys

import pytest

from spe_runtime.egac.conservation import InfoClass, Technique, run_gated, skeleton

R = InfoClass.REPLACEABLE
TY = "Thanks for reading.\n"
ROOT = pathlib.Path(__file__).resolve().parents[3]


def gate(text, deleted):
    return run_gated(Technique("t", frozenset({R}), "text", lambda t, **k: t.replace(deleted, "", 1)), text)


BRO_R7 = ["\u03baeep the line below.", "Keep e\u03c7act the line below.", "Repeat e\u03c7actly the line below.",
          "\u03baeep e\u03c7actly the line below.", "Repeat the line below e\u03c7actly.", "\u039aeep the line below."]


@pytest.mark.parametrize("t", BRO_R7)
def test_bro_round7_greek_directives_refused(t):
    assert gate("Keep the line below.\n" + TY, TY).allowed is False  # control: ASCII form refused
    assert not gate(t + "\n" + TY, TY).allowed, t


GREEK_WORDS = [("\u03baeep", "keep"), ("e\u03c7actly", "exactly"), ("r\u03b5peat", "repeat"), ("pri\u03b7t", "print"),
               ("ou\u03c4put", "output"), ("\u03c9rite", "write"), ("\u03bcse", "use"), ("\u03b2e", "be"),
               ("\u03c2opy", "copy"), ("\u03f2opy", "copy"), ("\u03f0eep", "keep"), ("r\u03f5peat", "repeat")]


@pytest.mark.parametrize("g,a", GREEK_WORDS)
def test_greek_lookalikes_fold_to_ascii(g, a):
    assert skeleton(g) == a


@pytest.mark.parametrize("g,a", [w for w in GREEK_WORDS if w[1] not in ("be", "use", "copy", "write")])
def test_greek_directive_word_refused(g, a):
    assert not gate(f"{a.capitalize()} the line below.\n" + TY, TY).allowed  # control
    assert not gate(f"{g} the line below.\n" + TY, TY).allowed, g


def test_existing_folds_unchanged():
    # UTS #39 targets kept: alpha, iota, nu, omicron, rho, sigma, upsilon, gamma; upper-case Greek; ASCII untouched.
    for c, t in (("\u03b1", "a"), ("\u03b9", "i"), ("\u03bd", "v"), ("\u03bf", "o"), ("\u03c1", "p"), ("\u03c3", "o"),
                 ("\u03c5", "u"), ("\u03b3", "y"), ("\u039a", "k"), ("\u03a7", "x"), ("m", "m"), ("rn", "rn")):
        assert skeleton(c) == t, c


def test_greek_prose_without_reference_not_over_blocked():
    assert gate("\u039a\u03b1\u03bb\u03b7\u03bc\u03ad\u03c1\u03b1 \u03c3\u03b5 \u03cc\u03bb\u03bf\u03c5\u03c2.\n" + TY, TY).allowed


def test_scope_v3_dedup_reanalysis_recomputes_byte_identically(tmp_path):
    subprocess.run([sys.executable, str(ROOT / "scripts/egac_scope_v3_dedup.py"), str(tmp_path)], check=True,
                   cwd=str(ROOT), capture_output=True)
    f = "scope_v3_dedup_rates.json"
    assert (tmp_path / f).read_bytes() == (ROOT / "docs/egac/scope_v3" / f).read_bytes()
