# Provider adapter matrix

| Profile or adapter | Where | What it is | Status |
| --- | --- | --- | --- |
| LOCAL_WASM | data/provider_profiles_v1.json | local profile, requires_network false, file and repo access declared inspect-only | PARTIAL |
| DETERMINISTIC | same file; bound by execution-contract test | version 1.0.0, authority not granted | PROVEN bind |
| EXTERNAL_OPTIONAL | same file | optional external profile | declared only |
| ANY_AI | packages/web-runtime render | prompt render | thin render, not a provider client |
| chatgpt, claude labels | packages/web-runtime/src/targets.ts | UI labels | NOT an adapter |
| Cursor | no protocol module | | NOT_FOUND |
| MCP server | conformance.py PLATFORM:MCP_SERVER PLANNED | | SPECIFIED_ONLY |

No hidden fallback was observed on the engine fixture (`used_ts_fallback false`). That is one fixture.
