"""Round 7 (Bro round-6 falsification @ a8d432e8).
1. "Ec\u0445o" (Cyrillic \u0445, read phonetically as "h") is folded for directive detection; UTS #39 x-folding kept.
2. Guard data extended with the 15 suffix / trailing-whitespace / edit-reference probes Bro found missing from the
   126-row round-6 guard (that guard captured only D() deletions). All 15 were refused at 1da24674 and must stay so.
3. SCOPE_BOUNDARY_v3 measured rates recompute byte-identically from the fixed seed."""
import json
import pathlib
import subprocess
import sys

import pytest

from spe_runtime.egac.conservation import InfoClass, Technique, _directive_skeleton, run_gated

R, U = InfoClass.REPLACEABLE, InfoClass.UNVERIFIED
TY = "Thanks for reading.\n"
ROOT = pathlib.Path(__file__).resolve().parents[3]


def gate(text, deleted, touches=frozenset({R})):
    return run_gated(Technique("t", touches, "text", lambda t, **k: t.replace(deleted, "", 1)), text)


@pytest.mark.parametrize("w", ["Ec\u0445o", "EC\u0425O", "Ec\u0445oes", "ec\u0445o"])
def test_cyrillic_kha_echo_is_a_directive(w):
    assert not gate(f"{w} the line below.\n" + TY, TY).allowed, w


def test_kha_folding_keeps_uts39_x_reading():
    sk = _directive_skeleton("Repeat e\u0445actly the line below.")
    assert "exactly" in sk and "ehactly" in sk
    assert not gate("Repeat e\u0445actly the line below.\n" + TY, TY).allowed


def test_kha_without_reference_is_not_over_blocked():
    assert gate("Ec\u0445o Park is lovely in spring.\n" + TY, TY).allowed


_X = json.loads((pathlib.Path(__file__).parent / "data" / "round7_guard_extra15.json").read_text())


def test_guard_extra_has_exactly_bros_15():
    assert len(_X["refused_at_1da24674"]) == 15


@pytest.mark.parametrize("touches", ["R", "RU"])
@pytest.mark.parametrize("i", range(15))
def test_round7_guard_extra15_still_refused(i, touches):
    r = _X["refused_at_1da24674"][i]
    tc = frozenset({R}) if touches == "R" else frozenset({R, U})
    out = r["output"]
    tech = Technique("t", tc, "text", lambda t, **k: out, appends=r["appends"])
    assert not run_gated(tech, r["text"]).allowed, (r["src"], r["text"][:60])


def test_scope_v3_rates_recompute_byte_identically(tmp_path):
    subprocess.run([sys.executable, str(ROOT / "scripts/egac_measure_scope_v3.py"), str(tmp_path)], check=True,
                   cwd=str(ROOT), capture_output=True)
    for f in ("scope_v3_corpus.jsonl", "scope_v3_rates.json"):
        assert (tmp_path / f).read_bytes() == (ROOT / "docs/egac/scope_v3" / f).read_bytes(), f
