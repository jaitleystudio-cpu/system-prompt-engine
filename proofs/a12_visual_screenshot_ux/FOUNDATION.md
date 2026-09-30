# A12 visual / screenshot UX foundation

Scope: `apps/web` view over existing image and screenshot observations. No second compiler. Website specification is unchanged.

## Flows

- Image → Visual
- Screenshot → Structure → Candidate UI

## Truth labels

Each reading carries four labels: text, assets, screen size, and match.

| Axis | Verdict in this foundation | Why |
| --- | --- | --- |
| Text | Not verified | Text-like bands may be noticed. Words are not checked. Supplied text stays untrusted. |
| Assets | Not verified | Color samples can be measured. Icons, photos, and fonts are not extracted. |
| Screen size | Not verified | One capture size can be measured. Other sizes and breakpoints are absent. |
| Match | Not verified | The candidate is a layout sketch. It is not a pixel-perfect recreation. |

Unknown is not treated as a pass. Absent evidence stays unknown.

## Limits

- Media adds no authority.
- The candidate is not a compiled app.
- Starter scaffolds remain prompts for a coding tool.

## Evidence

`npm run test:candidate-ui` in `apps/web`.
