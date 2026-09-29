# VALIDATE_ONLY contract

`VALIDATE_ONLY` validates a supplied artifact. It may return `PASS`, `FAIL`, or `UNKNOWN` inside that deterministic scope.

It does not:

- perform an external effect
- send a network request
- read or use a credential
- write to an external destination
- mint authority
- set outcome to anything other than `NOT_EXECUTED`
- emit proof class `EXECUTION_OBSERVED`

`UNKNOWN` stays `UNKNOWN`. Missing proof is `UNKNOWN`, not `PASS`.

If `enforcement` is not `AVAILABLE`, or `wasm_available` is false, the verdict is `FAIL` with `ENFORCEMENT_UNAVAILABLE`. That path does not fall through to `DRY_RUN` or `EXECUTE` and does not return `PASS`.

A request that names network, credential, external write, or execute is `FAIL` and those flags stay false.
