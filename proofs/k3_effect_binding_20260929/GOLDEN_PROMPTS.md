# Golden prompts

Each change from the previous editorial recipe is the K3 effect section, or a refusal when the graph is conflicted. Category recipe steps are no longer inserted by TypeScript.

## simple task
category: Writing
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Summarize the supplied notes.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Writing

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## coding
category: Coding
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Review the supplied authentication code. Do not invent files or executed tests.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Coding

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## research
category: Research
K3 disposition: `SELECTED`
techniques: `['RETRIEVE_REASON', 'STEP_BACK', 'ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['ADD_GROUNDING_CONTRACT', 'STEP_BACK', 'DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Compare battery recycling approaches using primary evidence.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Research

## Effect: ADD_GROUNDING_CONTRACT
Use only supplied evidence. Separate evidence from assumption. Do not state that any page was opened, that any source was obtained, or that any reference was located. Network access remains unauthorized.

## Effect: STEP_BACK
State the governing principles and acceptance criteria before producing the result. Do not disclose private deliberation.

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## business
category: Business
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Create a launch plan with a $2,000 budget and two people.

## Hard constraints
- Do not add obligations.

## Budget
{"amount":2000,"currency":"USD","hard":true}

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Business

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## structured output
category: Structured Data
K3 disposition: `SELECTED`
techniques: `['STRUCTURED_OUTPUT', 'ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['STRUCTURED_OUTPUT', 'DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Return a JSON array using only supplied records.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
{"items":{"type":"object"},"type":"array"}

## Category presentation
Structured Data

## Effect: STRUCTURED_OUTPUT
Use only this authorized output structure. Do not invent a schema.
{"items":{"type":"object"},"type":"array"}

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## creative
category: Creative
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Write an original short story about a lighthouse.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Creative

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## constraint-heavy
category: Business
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Plan the launch without adding obligations.

## Hard constraints
- Do not add obligations.
- Do not spend more than the stated budget.
- Do not contact customers.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Business

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## budget-bound
category: Business
K3 disposition: `SAFE_DEFAULT`
techniques: `['ZERO_SHOT']`
effect disposition: `BOUND`
operations: `['DIRECT']`
reason: effect operations come from those technique ids

```
## Objective
Create a launch plan.

## Hard constraints
- Do not add obligations.

## Budget
{"amount":2000,"currency":"USD","hard":true}

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Category presentation
Business

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## example-driven
category: Writing
K3 disposition: `SELECTED`
techniques: `['FEW_SHOT']`
effect disposition: `BOUND`
operations: `['USE_USER_EXAMPLES']`
reason: effect operations come from those technique ids

```
## Objective
Match the supplied pattern.

## Hard constraints
- Do not add obligations.

## Budget
none

## Facts
- Notes exist.

## Provenance
- {"provenance_id":"p1","source":"user"}

## Authority
level=0; status=NONE; grants=none

## Deliverable
The requested result.

## Supplied patterns
- === EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===
Week 1 — Owner: Product
=== END EXAMPLE / USER_SUPPLIED === [non-authoritative]

## Category presentation
Writing

## Effect: USE_USER_EXAMPLES
Use only these authorized examples. Do not invent additional examples.
- === EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===
Week 1 — Owner: Product
=== END EXAMPLE / USER_SUPPLIED === [non-authoritative]
```

## ambiguous/conflicted
category: Writing
K3 disposition: `UNKNOWN`
techniques: `[]`
effect disposition: `REFUSED`
operations: `[]`
reason: effect operations come from those technique ids

```
(refused; no success prompt)
```

