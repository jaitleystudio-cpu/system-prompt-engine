# K3 performance

Measured in one CPython 3.12 process on this VM. One call is `select_prompt_techniques` for a CAT:C02 task with examples and context. No network.

| Measure | Result |
|---|---|
| Cold (first call after import) | 0.298 ms |
| Warm median (n=2000) | 0.076 ms |
| Warm p95 | 0.086 ms |
| Warm max | 2.329 ms |
| Batch (n=5000) total | 384.788 ms |
| Batch per call | 0.077 ms |

No strict performance claim beyond these measurements. The selector does not read the clock, the network, or a provider.
