# CODEVISION v1 foundation

Status: structure contract only. Visual fidelity is **not** proven.

This package turns a supplied screenshot observation into six structure targets.
It does not decode PNG or JPEG bytes, call a vision model, or emit a fidelity score.

Input schema: `schemas/codevision_observation.schema.json`  
Structure schema: `schemas/codevision_structure.schema.json`  
Proof schema: `schemas/codevision_visual_fidelity_proof.schema.json`  
Runtime: `spe_runtime/codevision/`

`source_kind` must be `screenshot_observation`. Image payloads and keys such as
`image_base64`, `pixels`, or `pixel_score` are refused.

## Six structure targets

The compiler always emits these targets, in this order:

| Target | What it records |
| --- | --- |
| `region_tree` | Containment. One frame root whose box is the canvas. Child order is y, then x, then z-index, then node id. |
| `element_inventory` | Supplied node kinds: `frame`, `region`, `text`, `image`, `control`, `icon`, `unknown`. `unknown` stays `unknown`. Kind counts are a census of supplied nodes. |
| `text_runs` | Supplied text, exact, with a reading index from the same geometric order. No recognition confidence. |
| `style_observations` | Only style fields present on the observation: fill, border, radius, font size, font weight. Missing fields are not invented. Hex is stored as `#RRGGBB`. |
| `spatial_relations` | Direct `contains` edges, plus sibling `stacked_above`, `beside`, and alignment. Alignment tolerance is 2px (`rule_delta_px`) or 4 half-pixels for centers (`rule_delta_half_px`). Those deltas are rule inputs. Overlap and cross-parent alignment are omitted in v1. |
| `repeat_groups` | Direct siblings with the same kind and the exact same width and height, at least two members. A one-pixel difference does not match. This is not a similarity score. |

Bounds: at most 500 nodes, depth at most 32, canvas edge at most 16384.

## Visual-fidelity proof format

`build_visual_fidelity_proof` writes a document whose status is `UNPROVEN`.

The schema fixes:

- `visual_fidelity_status` = `UNPROVEN`
- `visual_fidelity_proven` = `false`
- `pixel_comparison` = null
- `numeric_fidelity_score` = null
- `measured` = empty
- `unmeasured` = `pixel_perfect`, `perceptual_match`, `rendered_rescreenshot_match`, `human_visual_rating`, `numeric_fidelity_score`

`structure_contract_status` = `CHECKED` means the structure document matched its schema. It does not mean the picture was reproduced.

Target counts on the proof are emission censuses (`counts_are` = `structure_emission_census`).

## Still unproven

- Pixel match, perceptual match, and any numeric fidelity score
- Re-rendering the structure and comparing a new screenshot
- Human visual rating
- That supplied kinds, text, or styles are what a viewer would name
- Image decoding and vision-model observations
- Code emission from these targets
