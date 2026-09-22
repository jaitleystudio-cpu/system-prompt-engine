# Human Perspective implementation report

The two supplied language papers are implemented as a shared presentation layer. This change does not alter professional prompt generation, Rust semantics, WASM bytes or the frozen study.

## Requirement mapping

| Paper stage | Result |
|---|---|
| H1 Constitution | `CONSTITUTION.md`: truth, agency, depth and ownership rules |
| H2 Schemas | Typed audience, surface, intent, candidate, interpretation and output contracts |
| H3 Brand voice | Curated English catalog; precise, warm wording without unverified superiority |
| H4 Risk review | Context-sensitive deterministic rules and explicit review verdicts |
| H5 Hero library | Seven curated variants selected from explicit category/current-session actions |
| H6 Website adapter | Hero, workspace, processing, completion, recovery, privacy and file surfaces |
| H7 App adapter | Shared mobile/desktop action contracts and fixtures; no native application shipped |
| H8 Extension adapter | Shared action contract and fixture; no browser extension shipped |
| H9 Plugin adapter | AI/coding-plugin action contracts and fixtures; no plugin product shipped |
| H10 Internationalization | Reviewed English source, explicit fallback; other locales need competent human review |
| H11 Tests | Golden, adversarial, context-sensitive diagnostics, surface and gate-rejection checks |
| H12 Release gate | Production build rejects unreviewed strings and detected prohibited claims |

## Measured evidence

- Full Python regression: 450 passed (45.23 seconds).
- Real-WASM prompt regression: 13 category cases passed, including fact preservation, artifact tampering, explicit conflicts and wrong-request rejection.
- Language gate: 443 inventoried candidates, zero unreviewed entries, zero detected violations.
- Copy tests: nine adversarial cases, 13 surface fixtures, seven hero variants; unknown locale fallback and diagnostics depth checked. An injected unreviewed 10x claim caused the gate to fail as expected.
- Production build passed with the language gate enabled.
- Browser review: coding sample prepared a detailed prompt with the original objective. Create mode hid preparation stages and JSON controls; Inspect restored them. Desktop and mobile screenshots are retained under `proofs/human-perspective/` locally. The mobile 390-pixel viewport reported content width 375 pixels, without horizontal overflow.

## Source corrections and limitations

Some paper examples implied automatic understanding, filling missing information, perfect preservation or no account anywhere. Those claims exceed the deterministic engine and private hosting behavior. The implementation describes preparation accurately, preserves exact diagnostics under Technical details, and discloses hosted sign-in separately from provider independence.

The inventory is a conservative static-source screen and includes some internal literals. It excludes dynamic user text, generated professional prompts and engine implementation diagnostics; the latter are surfaced through contextual disclosure. Claim references identify canonical facts but do not prove arbitrary prose equivalent to them. Regex review cannot establish semantic truth or predict human response. Editorial perspective records are assistant assessments, not participant studies, cultural validation or accessibility certification.

No fresh performance score, independent visual-panel score, 4K certification, award, World #1 ranking or production qualification is claimed. This delivery applies the papers' language architecture to the existing spatial design; it is not a newly rebuilt 3D art direction. Broader aesthetic approval remains open.

## Reproduce

From repository root:

```sh
node tests/copy/golden-and-adversarial.mjs
node tools/copy-check.mjs
.venv/bin/python -m pytest -q
npm --prefix apps/web run build
```

Review changed copy before deliberately updating `tests/copy/reviewed-inventory.json`. The build must not regenerate approvals automatically.
