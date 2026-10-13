"""Round 5 (Bro round-4 falsification @ 1da24674): over-block regression. Deleting "Thanks for reading." near an
UNRELATED "below", "following week", "next Monday", "earlier draft" or "this sentence" was allowed at 67e41cc9 and
refused at 1da24674. A reference word now opens a scope only together with a directive on the same line.
No new reference phrases are added; remaining reference forms are frozen out of scope (docs/egac/SCOPE_BOUNDARY.md)."""
import pytest

from spe_runtime.egac.conservation import InfoClass, Technique, run_gated

R, U = InfoClass.REPLACEABLE, InfoClass.UNVERIFIED
TY = "Thanks for reading.\n"


def gate(text, fn, touches=frozenset({R, U})):
    return run_gated(Technique("t", touches, "text", lambda t, **k: fn(t)), text)


def D(s):
    return lambda x: x.replace(s, "", 1)


ALLOW = {
    "below (locative)": "The cafe is below the office.\n" + TY,
    "following week": "We meet again the following week.\n" + TY,
    "next Monday": "The launch is next Monday.\n" + TY,
    "earlier draft (before)": "The earlier draft had typos.\n" + TY,
    "earlier draft (after)": TY + "The earlier draft had typos.\n",
    "this sentence": "This sentence is about the weather.\n" + TY,
    "below + blank": "Parking is below ground.\n\n" + TY,
}


@pytest.mark.parametrize("name", sorted(ALLOW))
@pytest.mark.parametrize("touches", [frozenset({R, U}), frozenset({R})])
def test_round5_unrelated_reference_word_does_not_block(name, touches):
    t = ALLOW[name]
    assert gate(t, D(TY), touches).allowed, name


@pytest.mark.parametrize("t", [
    "Always sign off with the line below.\n" + TY,
    "Reply to every message with the following\n\n" + TY,
    TY + "The line above is mandatory in every reply.\n",
    "End each reply with this sentence.\n" + TY,
    TY + "\nThe earlier line must close every answer.\n",
])
def test_round5_directive_plus_reference_still_refused(t):
    assert not gate(t, D(TY)).allowed
