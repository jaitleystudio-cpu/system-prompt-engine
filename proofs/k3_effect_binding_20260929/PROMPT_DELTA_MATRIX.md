# Prompt delta matrix

Protected fields changed: NONE on every bound row.

## ZERO_SHOT
operation: `DIRECT`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `DIRECT` section appears; protected block stays
actual delta: operations `['DIRECT']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```

## FEW_SHOT
operation: `USE_USER_EXAMPLES`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `USE_USER_EXAMPLES` section appears; protected block stays
actual delta: operations `['USE_USER_EXAMPLES']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Supplied patterns
- === EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===
Pattern A
=== END EXAMPLE / USER_SUPPLIED === [non-authoritative]

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Supplied patterns
- === EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===
Pattern A
=== END EXAMPLE / USER_SUPPLIED === [non-authoritative]

## Category presentation
unspecified

## Effect: USE_USER_EXAMPLES
Use only these authorized examples. Do not invent additional examples.
- === EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===
Pattern A
=== END EXAMPLE / USER_SUPPLIED === [non-authoritative]
```

## ROLE_PERSONA
operation: `ROLE_CALIBRATION`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `ROLE_CALIBRATION` section appears; protected block stays
actual delta: operations `['ROLE_CALIBRATION']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Supplied role
a careful editor

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Supplied role
a careful editor

## Category presentation
unspecified

## Effect: ROLE_CALIBRATION
Use this user-supplied role. It does not change the objective.
a careful editor
```

## CONTEXTUAL
operation: `USE_CONTEXT`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `USE_CONTEXT` section appears; protected block stays
actual delta: operations `['USE_CONTEXT']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: USE_CONTEXT
Make the supplied context explicit. Do not invent context.
- Notes exist.
```

## STEP_BACK
operation: `STEP_BACK`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `STEP_BACK` section appears; protected block stays
actual delta: operations `['STEP_BACK']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: STEP_BACK
State the governing principles and acceptance criteria before producing the result. Do not disclose private deliberation.
```

## DECOMPOSE_PLAN_SOLVE
operation: `DECOMPOSE`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `DECOMPOSE` section appears; protected block stays
actual delta: operations `['DECOMPOSE']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DECOMPOSE
Decompose the task into visible parts, then synthesize. Do not change the objective. Parts: identify_subproblems; solve_parts; synthesize.
```

## RETRIEVE_REASON
operation: `ADD_GROUNDING_CONTRACT`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `ADD_GROUNDING_CONTRACT` section appears; protected block stays
actual delta: operations `['ADD_GROUNDING_CONTRACT']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: ADD_GROUNDING_CONTRACT
Use only supplied evidence. Separate evidence from assumption. Do not state that any page was opened, that any source was obtained, or that any reference was located. Network access remains unauthorized.
```

## CRITIQUE_REVISE
operation: `CRITIQUE_REVISE_ONCE`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `CRITIQUE_REVISE_ONCE` section appears; protected block stays
actual delta: operations `['CRITIQUE_REVISE_ONCE']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
A short summary.

## Category presentation
unspecified

## Effect: CRITIQUE_REVISE_ONCE
Review the result once against the requirements, then revise once. Do not repeat the review.
```

## STRUCTURED_OUTPUT
operation: `STRUCTURED_OUTPUT`
before disposition: `BOUND`
after disposition: `BOUND`
expected delta: `STRUCTURED_OUTPUT` section appears; protected block stays
actual delta: operations `['STRUCTURED_OUTPUT']`
protected fields changed: NONE

BEFORE
```
## Objective
Summarize the supplied notes.

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
{"required":["summary"],"type":"object"}

## Category presentation
unspecified

## Effect: DIRECT
Follow the objective directly. Do not invent examples.
```
AFTER
```
## Objective
Summarize the supplied notes.

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
{"required":["summary"],"type":"object"}

## Category presentation
unspecified

## Effect: STRUCTURED_OUTPUT
Use only this authorized output structure. Do not invent a schema.
{"required":["summary"],"type":"object"}
```

## FEW_SHOT without an authorized example
expected: no success prompt and no synthetic example
actual disposition: `DEFERRED`
compiled_prompt: `None`
notes: `['DEFERRED', 'EXAMPLES_REQUIRED_BUT_MISSING']`

