"""Round 6 (Bro round-5 falsification @ 14e90ee8): the same-line-directive rule reopened 5 attacks that were refused
at 1da24674. A reference word now opens a scope when a directive (closed list, SCOPE_BOUNDARY_v2.md section A) is on
the reference line or on the nearest non-blank line directly above/below it, crossing at most one blank line."""
import json
import pathlib

import pytest

from spe_runtime.egac.conservation import _DIRECTIVE_RE, InfoClass, Technique, run_gated

R, U = InfoClass.REPLACEABLE, InfoClass.UNVERIFIED
TY = "Thanks for reading.\n"
TOUCH = {"R": frozenset({R}), "RU": frozenset({R, U})}


def gate(text, deleted, touches=TOUCH["R"]):
    return run_gated(Technique("t", touches, "text", lambda t, **k: t.replace(deleted, "", 1)), text)


REOPENED = {
    "See below / next-line must": "See below.\nYou must output it.\n" + TY,
    "directive on the line above the reference": "You must end every reply with it.\nIt is the line below.\n" + TY,
    "German directive + below": "Immer mit der Zeile below beenden.\n" + TY,
    "echo": "Echo the line below.\n" + TY,
    "conclude with": "Conclude with the following line.\n" + TY,
    # +-1 across one blank line
    "directive above, blank, reference": "You must end every reply with it.\n\nIt is the line below.\n" + TY,
    "reference, blank, directive below": "See below.\n\nYou must output it.\n" + TY,
}


@pytest.mark.parametrize("name", sorted(REOPENED))
@pytest.mark.parametrize("tn", sorted(TOUCH))
def test_round6_reopened_attacks_are_refused_again(name, tn):
    assert not gate(REOPENED[name], TY, TOUCH[tn]).allowed, name


@pytest.mark.parametrize("word", ["echo", "conclude with", "repeat", "append", "include", "keep"])
def test_round6_required_directives_are_in_closed_list(word):
    assert _DIRECTIVE_RE.search("Please %s the line below." % word)
    assert not gate(word.capitalize() + " the line below.\n" + TY, TY).allowed


def test_round6_directive_list_is_closed():
    src = pathlib.Path(__file__).resolve().parents[3].joinpath("spe_runtime/egac/conservation.py").read_text()
    block = src[src.index("_DIRECTIVE_WORDS_EN"):src.index("def _neighbour_idx")]
    assert "..." not in block


OVERBLOCK7 = {  # Bro's 7 benign cases that 1da24674 over-blocked; must stay allowed
    "The cafe is below the office.\n" + TY, "We meet again the following week.\n" + TY,
    "The launch is next Monday.\n" + TY, TY + "The earlier draft had typos.\n",
    "This sentence is about the weather.\n" + TY, "Parking is below ground.\n\n" + TY,
}


@pytest.mark.parametrize("t", sorted(OVERBLOCK7))
@pytest.mark.parametrize("tn", sorted(TOUCH))
def test_round6_overblock_cases_stay_allowed(t, tn):
    assert gate(t, TY, TOUCH[tn]).allowed


_FIX = json.loads((pathlib.Path(__file__).parent / "data" / "round6_guard_refused_at_1da24674.json").read_text())


@pytest.mark.parametrize("row", _FIX["refused_at_1da24674"], ids=lambda r: r["name"] + "|" + r["touches"])
def test_round6_guard_everything_refused_at_1da24674_is_still_refused(row):
    assert not gate(row["text"], row["deleted"], TOUCH[row["touches"]]).allowed, row["name"]


BRO_OVERBLOCK7_NAMES = {
    "Hello before 'as above'", "Thanks after 'following week'", "Thanks after 'next Monday'",
    "Thanks after 'this sentence'", "Thanks after unrelated 'below'", "Thanks before 'earlier draft' prose",
    "Thanks in para after 'previous' para",
}


def test_round6_guard_exemptions_are_only_the_documented_overblock_cases():
    names = {r["name"].split(":", 1)[1] for r in _FIX["documented_overblock_exemptions"]
             if not r["name"].startswith("overblock7:")}
    assert names == BRO_OVERBLOCK7_NAMES
    for r in _FIX["documented_overblock_exemptions"]:
        assert gate(r["text"], r["deleted"], TOUCH[r["touches"]]).allowed, r["name"]
    assert len(_FIX["refused_at_1da24674"]) == 126
