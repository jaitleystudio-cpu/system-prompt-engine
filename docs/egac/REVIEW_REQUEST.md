# Review request for Bro — EGAC-1 R0 (Mechanism A + E01)

Branch `grok/egac1-r0` off `grok/agi-brain-r0` @ 8a2904ad. Not pushed, not merged. Implementation agent cannot certify.

Commits: 066af190 (frozen E01 contract), 42e051ef (code+tests+harness, pre-run), then results commit.

## Please verify
1. Custody: contract sha256 c6e67071…f811e in 066af190 precedes 42e051ef and the evidence.
2. `spe_runtime/egac/conservation.py`: 5-class classifier (reuses `ProtectedIntent`), custom JSON lexer, gate
   (`run_gated`) refuses immutable-class touches, verifies conserved spans in order and exact-byte token stream.
   Try to construct a transform that alters protected/exact-byte content and still passes the gate.
3. `transforms.py`: 8 techniques with declared classes; output budget refuses when contract > cap; cache key over
   prompt+user scope+auth scope+model+version+freshness, partitioned per user, TTL, volatile prompts refused.
4. Tests: `python -m pytest tests/research/egac` (34 pass).
5. Replay E01: start Ollama, pull `qwen2.5:0.5b` (digest a8b0c515…1827c67), run
   `python -m spe_runtime.egac.e01 /tmp/e01_replay` and compare to evidence/egac/e01/results.json
   (tokens should match exactly; latency will differ; success should match at temperature 0 / seed 1729).
6. Judge whether NOT_PROVEN is the correct application of the frozen rule, and whether the nonce deviation matters.

Known gaps: classifier is regex/line based (precision on real prompts unmeasured); only T1 tested end-to-end;
one tiny model; synthetic tasks; no provider dollar data.
