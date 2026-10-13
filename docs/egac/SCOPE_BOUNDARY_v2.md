# EGAC conservation gate: frozen scope boundary v2 (round 6, 2026-10-13)

This file is FROZEN. Its sha256 is in `docs/egac/SCOPE_BOUNDARY_v2.sha256`. It supersedes, but does not edit,
`SCOPE_BOUNDARY.md` (v1, sha256 in `SCOPE_BOUNDARY.sha256`, kept unchanged). **Any meaning-changing deletion that is
ALLOWED and is not enumerated in section C below is a defect, not a scope limit.**

**EGAC is lexical. It cannot resolve arbitrary references.**

## A. Closed directive list (replaces the v1 "..." list)
A reference word opens a scope only when one of these words (case-insensitive, whole word) is on the reference line
OR on the nearest non-blank line directly above or below it, crossing at most one blank line ("reference line +-1"):
- English: sign, sign-off, signoff, sign off, signs, signed, end, ends, close, closes, reply, replies, respond,
  responds, answer, answers, append, appends, prepend, prepends, include, includes, repeat, repeats, echo, echoes,
  quote, quotes, copy, copies, insert, inserts, output, outputs, print, prints, keep, keeps, preserve, preserves,
  retain, retains, use, uses, conclude, concludes, finish, finishes, ensure, ensures, show, shows, add, adds, put,
  puts, write, writes, say, says, state, states, must, mandatory, required, require, requires, shall, always, every,
  each, verbatim, exact, exactly, never, do not, don't, dont.
- German: immer, muss, musst, müssen, beende, beenden, antworte, antworten, schreibe, schreiben, füge, wiederhole.
- Spanish: siempre, debe, debes, termina, terminar, responde, responder, incluye, incluir, repite, repetir.
No other word is a directive. ("conclude with" is covered by "conclude".)

## B. In scope (tested)
- Reference words (v1 list, unchanged: below, following, next, next-but-one, as follows, hereafter, underneath,
  beneath, this/that/these [exact] line/sentence/text/phrase/message/wording/sign-off/closing, above, previous,
  preceding, prior, aforementioned, foregoing, earlier, former, last line/sentence/paragraph) with a section-A
  directive within reference line +-1.
- `:` contract lines and contract keywords; quotes; fences (closed and unclosed); markdown hard breaks.
- Regression guard: all 126 (case, touches) pairs refused at 1da24674 in Bro's round 1-5 probe corpus stay refused
  (`tests/research/egac/data/round6_guard_refused_at_1da24674.json`); the only exemptions are Bro's 7 documented
  over-block cases (section D).

## C. Out of scope (frozen, enumerated): deletion may be ALLOWED although meaning changes
1. Ordinal / numbered references: "three lines down", "line 3", "the first line", "the final line of this prompt".
2. Reference phrases not in the section-B list: "the line that follows", "subsequent line", "the sentence after
   this one".
3. Non-English reference words (the reference itself, not the directive): German "unten", Spanish "abajo",
   Hindi, Telugu; e.g. "Siempre termina con la línea de abajo.".
4. Fence-crossing references: a reference inside a code block or code comment pointing at prose outside it, or the
   reverse.
5. Distant references: back/forward references more than one paragraph away ("two paragraphs up", "valid until"
   two paragraphs away), and a "below" whose scope captured one line, then a blank line, then the real target.
6. Directive further than reference line +-1 (two or more non-blank lines away, or across two or more blank lines),
   or a directive expressed only with words not in section A.
7. (v1 catch-all "semantic dependence" is REMOVED and replaced by these enumerated items:)
   7a. Pronoun-only dependence with no reference word: "Add it to every answer." where "it" is the deleted line.
   7b. Dependence through a named label: "Use the SIGNOFF block." where the block is not fenced or quoted.
   7c. Dependence through counting/format constraints: "Match the number of lines in this prompt." (deleting a line changes the count)

## D. Over-block (documented trade-off)
Bro's 7 benign cases from round 4 (unrelated "below", "following week", "next Monday", "earlier draft", "previous"
paragraph, "as above", "this sentence") stay ALLOWED. Bro's separate 7-case benign set stays 5/7 refused. Typo fixes
and double-space collapse stay refused. A benign line next to a section-A word (e.g. "We always meet below the
bridge.") is refused; this widened window is measured only on the probe corpus, not on real prompts.

## E. Consequence for claims
An EGAC "allowed" verdict means "no lexical cue in sections A/B protected the deleted text", not "meaning preserved".
E01 stays NOT_PROVEN; re-gate 120/120 allowed, treatment sha16 48b471c474652f2d.
