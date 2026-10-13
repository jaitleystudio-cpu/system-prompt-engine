# EGAC conservation gate: frozen scope boundary (round 5, 2026-10-13)

This file is FROZEN. Its sha256 is in `docs/egac/SCOPE_BOUNDARY.sha256`. Changes need a new file, not an edit.

**EGAC is lexical. It cannot resolve arbitrary references.** It decides whether a line may be deleted from
surface cues on nearby lines: `:` contract lines, contract keywords, quotes, fences, and (from round 4) a
reference word (below / following / next / as follows / above / previous / earlier / ...) that sits on the
same line as a directive (sign / end / close / reply / append / repeat / must / mandatory / always / every /
verbatim / exact / ...). Bro's round-4 falsification (1da24674) showed that adding reference phrases one by one is
a whack-a-mole loop that also raised over-block. Round 5 stops adding phrases and freezes the boundary below.

## In scope (tested)
Same-line, same-or-adjacent-paragraph references of the kinds in tests/research/egac (round-3/4/5 test files):
"the line below", "shown below" (+ blank lines until one line is captured), "the following", "as follows",
"next-but-one line", "this exact sentence:", "the line above", "the previous sentence", "the text above", each
together with a directive; `:` scopes; quotes; fences (closed and unclosed); markdown hard breaks.

## Out of scope (frozen): deletion may be ALLOWED although meaning changes
1. **Ordinal and numbered lines**: "three lines down", "line 3", "the first line", "the final line of this prompt".
2. **"The line that follows" and similar relative-clause / synonym forms**: "the line that follows",
   "subsequent line", "the sentence after this one", and any reference word not in the round-4 list.
3. **Non-English references**: German "unten", Spanish, Hindi, Telugu or any other language, with or without
   blank or filler lines.
4. **Fence-crossing references**: a reference inside a code block or code comment pointing at prose outside the
   fence (or the reverse).
5. **Distant references**: back- or forward-references more than one paragraph away (e.g. two paragraphs up,
   "valid until" two paragraphs away), and a "below" whose scope captured one line followed by a blank line and
   then the real target.
6. **Reference without a same-line directive**: "The line below matters." / "See the following." with the
   directive on a different line. (Round 5 trade-off that fixes the over-block.)
7. **Semantic dependence** of any kind not expressed by the lexical cues above.

## Over-block (also out of scope to fix further)
Bro's 7-case benign set stays 5/7 refused (documented trade-off). The 7 round-4 over-block regressions
("Thanks for reading." near unrelated "below", "following week", "next Monday", "earlier draft", "this sentence")
are allowed again (round-5 tests). Real-prompt over-block is not measured.

## Consequence for claims
An EGAC "allowed" verdict means "no lexical cue in scope protected the deleted text", not "meaning preserved".
E01 stays NOT_PROVEN; re-gate 120/120 allowed, treatment sha16 48b471c474652f2d.
