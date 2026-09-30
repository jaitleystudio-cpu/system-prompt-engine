# CV6 active-skill trust receipt

Read-only review of the skill documents current SPE work can actually load. No prior `proofs/skill-trust/` ledger existed in this tree or on `origin/main`, so nothing was promoted from a stored `PIN_MISSING` or `UNREVIEWED` row. This file is the ledger.

Checkout: `bd4540a9c96801168f2e7363c001a4184bad4311` (detached, then this branch).

Current missions used to choose the set:

- Engineering verification on this checkout (test-first implementation, root-cause debugging, evidence before completion claims).
- Website verification already in tree (`apps/web`, `proofs/spe_v1_launch`, `proofs/spe_v1_gap_closure` accessibility checklist). The launch report names the duyêt `frontend-design` skill.
- SEO orchestration and content-strategy planning are not missions in this tree.

Not selected, because the named folder is absent from the account skill store and from installed plugin copies: `security-and-hardening`, `accessibility`, `performance`, `web-performance`.

The git tree of this repository does not vendor any of these skills.

Folder hash: SHA-256 over sorted relative paths. Each path is updated, then a NUL, then the raw SHA-256 of the file bytes, then a NUL. No `.git` directories were present in these folders.

## States

`REVIEWED_FOR_CURRENT_USE` means the document bytes match a verified commit, and the hot path (hooks, scripts, network, shell, credentials) was read far enough to allow that document on the missions above.

`PIN_MISSING` means those bytes are not a verified commit. They were not promoted.

`UNREVIEWED` means a pin was verified and the hot path has no executor, but the skill is not a current mission, so it was not promoted.

## Reviewed for current use

### verification-before-completion

- Source: https://github.com/obra/superpowers (`skills/verification-before-completion/`)
- Commit: `d884ae04edebef577e82ff7c4e143debd0bbec99` (local plugin git `HEAD`, GitHub commit API, blob `2f14076e59e6ce5cd6f88007421a85f0bd772520`)
- Copies: account store and plugin cache are the same folder hash `06b2facf2f426c9fce490cecd546c5f88f566c5adef3420d864c5e3d75bcba17`
- Hooks/scripts: none in the skill folder
- Network: none
- Shell: instructions tell the agent to run the repo's own verification commands. No bundled shell script
- Credentials: none
- Adjacent plugin hook: `hooks/session-start` cats `skills/using-superpowers/SKILL.md` and prints JSON. No network and no credentials
- State: `REVIEWED_FOR_CURRENT_USE`

### test-driven-development (plugin copy only)

- Source: https://github.com/obra/superpowers (`skills/test-driven-development/`)
- Commit: `d884ae04edebef577e82ff7c4e143debd0bbec99`
- Blobs match that commit: `SKILL.md` `60d2609ca56c7177a98f462fb71af77844ce92af`, `testing-anti-patterns.md` `e77ab6b6d65ecfb0d8212a32186bf68d18b5eade`
- Folder hash: `418064b369b352cf091edbdc0f3cbd6dafafb6fc0abf2a45bc46a3da99363485`
- Hooks/scripts: none in the skill folder
- Network: none
- Shell: none bundled. The text tells the agent to run tests
- Credentials: none
- State: `REVIEWED_FOR_CURRENT_USE`

The account folder `/cursor/stores/user/skills/test-driven-development` is empty. That copy stays `PIN_MISSING`.

### systematic-debugging (plugin copy only)

- Source: https://github.com/obra/superpowers (`skills/systematic-debugging/`)
- Commit: `d884ae04edebef577e82ff7c4e143debd0bbec99`
- Folder hash: `01804641c17125586025a8f8434943cd53965b39bb26197530e656fecbde4f92`
- `SKILL.md` blob `b0eca38b3cf9523ea86c9211e96949c8e69d1d1c` and `find-polluter.sh` blob `1d71c56077dd819f0966cdae353fb142201611c6` match that commit
- Hooks: none in the skill folder. Same plugin `session-start` hook as above
- Script: `find-polluter.sh` runs `find` and `npm test` on a local test path. It does not open a network connection and does not read credentials
- State: `REVIEWED_FOR_CURRENT_USE`

The account copy folder hash is `86b5700b65d27ee6b5a160f7105612a8a9143602b741afbdd4087238629508a4`. It is not that commit. The only differences are wording: `Ultra-think` to `Ultrathink`, and two example paths rewritten to `/Users/jesse/...`. `find-polluter.sh` matches. Those account bytes stay `PIN_MISSING`.

### webapp-testing

- Source: https://github.com/anthropics/skills (`skills/webapp-testing/`)
- Commit: `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` (default-branch `HEAD` at review time). Every file in the account folder matches that commit: `SKILL.md`, `LICENSE.txt`, `scripts/with_server.py`, and the three examples
- Folder hash: `94642e9763bcd65faf76732a4bc5495382cfd2a7410d609861b3b0f986b5315d`
- Hooks: none
- Network: examples and the skill text use `http://localhost` only
- Shell: `scripts/with_server.py` uses `subprocess.Popen(..., shell=True)` for the `--server` string and `subprocess.run` for the trailing command, then polls `localhost` on the given port
- Credentials: none
- State: `REVIEWED_FOR_CURRENT_USE` for local SPE web verification. The helper runs whatever server command the caller passes

### frontend-design (official plugin)

- Source: https://github.com/anthropics/claude-plugins-official (`plugins/frontend-design/skills/frontend-design/`)
- Commit: `ed404106fcd80ba98ecb7c851e531dcb626d13b7`. `SKILL.md` blob `decdff43d05908b4c1fc2cfd2d80fc5743440934` and `LICENSE.txt` match
- Folder hash: `3466e16ec50a8ce675ac04c273e9e32d0abe3e2a6bcae7e2636ffd50426c5a86`
- Hooks/scripts: none
- Network: none
- Shell: none
- Credentials: none
- State: `REVIEWED_FOR_CURRENT_USE`

### frontend-design (duyêt plugin)

- Source: https://github.com/duyet/claude-plugins (`frontend-design/skills/frontend-design/`)
- Commit: `01ee09e1fd0e16fcd8f831e0e4b4ca79f9b19cf9`. `SKILL.md` blob `13a64d48852262122fb3a10071fbb2fbd27e5f7a` and `references/shadcn.md` match
- Folder hash: `54f94f667d2f2368a2b70de0532de11f2b877b8a91e11d0bb78930ad45551926`
- Hooks/scripts: none
- Network: the shadcn reference documents registry URLs (`ui.shadcn.com`, `v0.dev`). It does not fetch them
- Shell: none
- Credentials: `references/shadcn.md` shows placeholder registry headers (`Bearer ${REGISTRY_TOKEN}`, `X-API-Key`, `your_token_here`, `your_api_key_here`). No live secret is stored. Current SPE work does not use that registry example
- State: `REVIEWED_FOR_CURRENT_USE` as the design-direction document cited by `proofs/spe_v1_launch/SPE_WEBSITE_V1_FINAL_ACCEPTANCE_REPORT.md`

## Left exact

### Account frontend-design stub — PIN_MISSING

Folder hash `a339f0fdbefd4a958c7cbd3ac1bfaf4e8bfc548dbae6cfa64493ddf930512641`. The file only redirects to `/Users/prawinpalisetty/.cursor/plugins/local/experience-studio/skills/frontend-design/SKILL.md`. That path is not on this machine. No commit pin.

### web-design-guidelines — PIN_MISSING

Folder hash `37023542b0c2849ea66c1c9af34ff7bc0a22367a088d4c9f74317490319ed70b`. Same off-machine redirect, plus an instruction to fetch rules from a URL that lives in the missing file. The fetch target was not reviewed because it is not in the document.

### seo, seo-technical, seo-schema, seo-content — PIN_MISSING

Account folder hashes:

| Document | Folder hash |
| --- | --- |
| seo | `001fbd45134e17f6ee99c7ff3fce04e21bef893d96bd64eb7dd0407f4306ca6f` |
| seo-technical | `c4881a7190479ab797c4a56490c0f89786b474693e8d3cf21831c2843be12144` |
| seo-schema | `26f2f42861139e5c8b2fef8eb44505bf048c721943be5e17256440ff29357b94` |
| seo-content | `f6cb35f8d86bf6d553359787202ca5c043275273a7b0296a3eccd28c42bf4778` |

Claimed package version is 2.4.0 (AgriciDaniel/claude-seo). Annotated tag `v2.4.0` points at commit `e77e783e38eeb738424eb72117abbd2dacdd88af`. Tag `v2.4.1` points at `ff87fcee0734845d3f59128c8c905799ee2298da`. Local `skills/seo/SKILL.md` blob `c980a87753591d9333061fe5084ac4de286a19a5` matches neither tag. The three leaf `SKILL.md` blobs also match neither tag.

Some hot-path blobs do match `e77e783e`: `hooks/hooks.json`, `hooks/run-python-hook.js`, `hooks/validate-schema.py`, `scripts/claude-seo`, `scripts/fetch_page.py`, `scripts/google_auth.py`. `runtime-plugin.json` is not in that tree at the repo root. A mixed tree is not a pin.

Hot path, not promoted:

- Hook: `PostToolUse` on `Edit|Write` runs `node` → `run-python-hook.js` → `validate-schema.py` on the edited path. The validator reads the local file. The only `schema.org` strings are comparisons, not fetches. The hook still spawns a process on ordinary edits
- Scripts: 90 Python/JS/Markdown files scanned. 62 mention network clients or URLs, 10 mention subprocess/shell, 46 mention credentials or environment reads
- Credential environment names present in the tree include `GOOGLE_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `BING_WEBMASTER_API_KEY`, `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD`, `MOZ_API_KEY`, `MATOMO_API_TOKEN`, `KEYWORDSEVERYWHERE_API_KEY`, `INDEXNOW_KEY`, `GOOGLE_AI_API_KEY`

These four documents stay `PIN_MISSING`. They are not current SPE missions, and the installed markdown is not the tagged commit.

### content-strategy — UNREVIEWED

- Source: https://github.com/coreyhaines31/marketingskills (`skills/content-strategy/`)
- Commit: `5b2c0007766c6a1cf1d53fd8fc73e979e0821022`. `SKILL.md`, `evals/evals.json`, `references/content-distribution.md`, and `references/headless-cms.md` match
- Folder hash: `7502ed582feefed94b8f5bb32b9e1c1ad02ff893d958ae0c0d78ba6c6ee20719`
- Hooks/scripts: none
- Shell: none
- Credentials: none in those files
- State left `UNREVIEWED`. The pin is real, and this is not a current SPE mission, so it was not moved to `REVIEWED_FOR_CURRENT_USE`

## Not done

No skill script was executed. No merge, deploy, or host change. No edits under I1, WASM, xcat, k3, quality, or `spe-core-rs`.
