# INPUT LIMITS

## Home quick-start

| Case | Attempted | Accepted | Visible notice | Silent loss |
|---|---:|---:|---|---|
| 19,999 | 19,999 | 19,999 | meter only | NO |
| 20,000 | 20,000 | 20,000 | meter only | NO |
| 20,001 | 20,001 | 20,000 | overflow status + Create hint | NO |
| 100,000 | 100,000 | 20,000 | overflow status + Create hint | NO |

Limit: **20,000** characters (`HOME_QUICK_START_MAX_CHARS`).
Limit visible: meter + help text linking to Create.
Owner: `apps/web/src/landing/Hero.tsx` + `apps/web/src/input/boundedText.ts`
Browser proof: `npm run test:home-bound`

## Desired Output

Limit: **12,000** (`DESIRED_OUTPUT_MAX_CHARS`).
Overflow: accepted length capped; status notice; no HTML `maxLength` silent drop.
Owner: `UnifiedComposer.tsx`

## Example

Limit: **12,000** (`EXAMPLE_MAX_CHARS`).
Same behavior as Desired Output.

## Unit coverage

`npm run test:truth-privacy` exercises limit−1 / limit / limit+1 for Home, Desired, Example helpers.
