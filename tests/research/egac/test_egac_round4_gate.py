"""Round 4 (Bro round-3 falsification @ 67e41cc9): forward refs across blank lines, two-lines-up and backward
references, markdown hard breaks, unclosed fences. Each case was ALLOWED at 67e41cc9."""
import pytest

from spe_runtime.egac.conservation import InfoClass, Technique, run_gated, strip_prose_trailing_ws

R, U = InfoClass.REPLACEABLE, InfoClass.UNVERIFIED


def gate(text, fn, touches=frozenset({R, U})):
    return run_gated(Technique("t", touches, "text", lambda t, **k: fn(t)), text)


def D(s):
    return lambda x: x.replace(s, "", 1)


TY = "Thanks for reading.\n"
REFUSE = {
    "line below": "Always sign off with the line below.\n" + TY,
    "shown below + blank": "Always sign off with the text shown below.\n\n" + TY,
    "exact sentence: + blank": "End every reply with this exact sentence:\n\n" + TY,
    "exact sentence: + 2 blanks": "End every reply with this exact sentence:\n\n\n" + TY,
    "the following + blank": "Reply to every message with the following\n\n" + TY,
    "as follows + blank": "Close each answer as follows.\n\n" + TY,
    "two lines up": "Sign every reply with the next-but-one line.\nYou are helpful.\n" + TY,
    "backward ref": TY + "The line above is mandatory in every reply.\n",
    "backward ref + blank": TY + "\nThe previous sentence must end every reply.\n",
    "backward ref two lines up": TY + "You are helpful.\nThe text above is mandatory.\n",
}


@pytest.mark.parametrize("name", sorted(REFUSE))
@pytest.mark.parametrize("touches", [frozenset({R, U}), frozenset({R})])
def test_round4_meaning_changing_deletions_refused(name, touches):
    t = REFUSE[name]
    assert TY in t
    assert not gate(t, D(TY), touches).allowed, name


def test_round4_filler_without_reference_still_deletable():
    # control: the over-block did not swallow the plain case
    assert gate("You are helpful.\n\n" + TY, D(TY)).allowed


def test_round4_forward_scope_ends_after_capturing_one_line():
    t = "Always sign off with the line below.\n\nYou are helpful.\n\nHello.\n"
    assert gate(t, D("Hello.\n")).allowed           # scope consumed by "You are helpful." then ended by blank


def test_round4_markdown_hard_break_preserved():
    t = "Line one  \nLine two\n"
    assert not gate(t, lambda x: x.replace("one  \n", "one\n")).allowed
    assert strip_prose_trailing_ws(t) == t
    assert not gate("Line one  \nLine two\n", lambda x: x.replace("one  \n", "one \n")).allowed


def test_round4_trailing_ws_before_blank_or_eof_still_relaxed():
    assert strip_prose_trailing_ws("End.  \n") == "End.\n"
    assert strip_prose_trailing_ws("A.  \n\nB.\n") == "A.\n\nB.\n"


def test_round4_unclosed_fence_is_byte_exact():
    t = "```\ncode   \nmore\n"
    assert strip_prose_trailing_ws(t) == t
    assert not gate(t, lambda x: x.replace("code   \n", "code\n")).allowed
    t2 = "Intro.  \n\n```py\nx = 1   \n"
    assert strip_prose_trailing_ws(t2) == "Intro.\n\n```py\nx = 1   \n"
    assert not gate(t2, lambda x: x.replace("x = 1   \n", "x = 1\n")).allowed
