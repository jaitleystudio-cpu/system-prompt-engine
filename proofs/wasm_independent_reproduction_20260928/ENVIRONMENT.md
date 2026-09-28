# ENVIRONMENT

Independent Task B reproduction environment. Builds were not run in the agent workspace checkout.

## Freshness probe (before clone)

```
pwd: /workspace
uname: Linux cursor 6.12.94+ #1 SMP PREEMPT_DYNAMIC Thu Sep 24 16:04:37 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux
hostname: cursor
HOME: /home/ubuntu
workspace_has_target: 0
independent_repro_exists: NO
decision: FRESH — clone to /home/ubuntu/spe-independent-repro; do not build in /workspace
```

## Separation

| Path | Role |
| --- | --- |
| `/workspace` | Cursor agent workspace (Task A recipe already checked out). Not used for candidate builds. |
| `/home/ubuntu/spe-independent-repro` | Fresh `git clone` used for BUILD A and BUILD B. |
| `/tmp/spe-independent-path-b` | Second fresh `git clone` used for absolute-path independence. |

No pre-existing `target/` directories, no `spe-independent-*` clones, and no candidate WASM build products were present before cloning.

## Toolchain observed in clone A

```
rustc 1.98.1 (48a229cea 2026-09-01)
commit-hash: 48a229ceaefd4985c50990b14116b6d856af0985
host: x86_64-unknown-linux-gnu
LLVM version: 22.1.8

cargo 1.98.1 (797e8a9bc 2026-08-05)

active-toolchain: 1.98.1-x86_64-unknown-linux-gnu
  (overridden by '/home/ubuntu/spe-independent-repro/rust-toolchain.toml')

installed targets:
  wasm32-unknown-unknown
  x86_64-unknown-linux-gnu
```

## Other

- Node: v22.14.0 (`/exec-daemon/node`)
- Python harness: temporary venv `/tmp/spe-task-b-venv` with declared deps only (`pip install -e ".[dev]"`)
- Recorded at: `2026-09-28T17:00:11Z`

FRESH_AGENT = YES  
FRESH_CLONE = YES
