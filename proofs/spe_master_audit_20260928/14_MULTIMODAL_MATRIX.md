# Multimodal matrix

| Modality | Classification | Evidence this SHA |
| --- | --- | --- |
| Text | local compile path | create-intent EXIT 0; home 20k compile Ready to use |
| Speech-to-text | UI + Web Speech; fallback proven in Chromium | speech tests EXIT 0; device qualification open |
| Image | limits and pipeline source | test:media EXIT 0; no browser image this audit |
| Screenshot | upload UI + limits | fidelity tests EXIT 0 |
| Screenshot to code | prompt/scaffold only | six targets, no in-app runtime |
| Video | sampler limits | test:video-scenes EXIT 0 |
| Video to text | source path | not a qualified transcript product |
| URL / website | heuristic ingest | fetch helper vs CSP |
| Desired Output | HARD | create-intent |
| Example | NON_AUTHORITATIVE | create-intent |
| Files | HTML upload sliced | limits.ts |
| Image to prompt | source path | not browser-proven |

## Screenshot targets

| Target | Runtime | Adapter | Prompt/scaffold | UI | Not implemented |
| --- | --- | --- | --- | --- | --- |
| HTML/CSS | no | no | yes | yes | runtime |
| React | no | no | yes | yes | runtime |
| SwiftUI | no | no | yes | yes | runtime |
| Jetpack Compose | no | no | yes | yes | runtime |
| Flutter | no | no | yes | yes | runtime |
| React Native | no | no | yes | yes | runtime |

## URL intelligence

Heuristics exist for HTML, CSS, type, layout, motion, and WebGL, mostly inferred. Scroll storytelling, design DNA, URL-to-implementation-contract, and URL-to-single-file-site were not found. Norrly benchmark notes were not found as product code under `apps/web`. No proprietary site source was copied.
