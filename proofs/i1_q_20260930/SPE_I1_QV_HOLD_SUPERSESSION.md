# SPE I1-QV HOLD supersession

This note records a verifier hold. It does not repair the mismatch, retarget the pin, or authorize I2.

- d34d822 report = SUPERSEDED
- reason = canonical WASM clean rebuild mismatch discovered afterward
- runtime under test = 145b844d59161d54d8ea58d2586ec2cae16dbe8a
- runtime modified = NO
- current verifier verdict = I1_QV_HOLD
- pinned WASM sha b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b, bytes 1340112, imports 0
- rebuild A and B sha 931d154a2002bb5fa85a00f2b59b966b3bf452821ad47affcb6cb460fea0fad5, bytes 1339801, imports 0
- A == B yes; A/B == frozen pin no
- canonical build gate exit 1
- this note does not repair, retarget the pin, or authorize I2
- MEMORY.md from d34d822 must not be replayed onto the integration line
- canonical owner remains the Grok I1 agent on PR #71
- HOSTING forbidden
- DEPLOYMENT forbidden
- NO MERGE

The report at `d34d822534d2834b4a5d29742f5b23ff0c628436` (`proofs/i1_q_20260930/SPE_I1_Q_REPORT.md`) is superseded by this hold. The parent runtime `145b844d59161d54d8ea58d2586ec2cae16dbe8a` stays unchanged.
