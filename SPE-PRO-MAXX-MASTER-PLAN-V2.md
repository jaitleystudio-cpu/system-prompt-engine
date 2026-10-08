# SPE PRO MAXX v2.1 — Speak Your Life Into Order

Master architecture and execution plan • 1 October 2026

**Worldwide product promise:** Speak, forward a voice note or show a document. SPE helps you understand what happened, what was promised, what needs doing and which written record you need next—in your preferred language.

**Product thesis:** Oral life collides with written systems. SPE bridges that gap through a voice-first interface, source-linked obligations, care handoffs, guided forms and bilingual understanding. Transcription is infrastructure; a usable next step is the product. This is a product hypothesis to validate with users worldwide, not a proven market-size or novelty claim.

This replaces the original plan's design assumptions with concrete engineering decisions. It preserves the original artifact and implementation. “10/10” is the aspiration embodied by the ten objectives below; no certification, novelty, patentability or award is asserted.

## 1. A worldwide voice-first product

The default experience is **speak → hear what SPE understood → confirm → receive a useful record or next step**. Users should not need to read a transcript, understand a dashboard or compose an AI prompt. Elders, traders, field workers, busy parents and caregivers can complete core flows through short spoken turns and large tap controls. Voice is optional and user-initiated; touch, keyboard, captions and assistive technology remain equivalent access paths.

Example: a repair customer forwards, “I will replace the part by Friday for fifty,” alongside an invoice. SPE reads back: “I heard a replacement promised by Friday, price fifty. Which currency, and which Friday?” It creates an editable promise record linked to the original voice span. A family member instead says, “Night handoff: she ate at eight, the pharmacy pickup is tomorrow, and we still need to ask the nurse about the changed prescription.” SPE produces a short handoff and separates confirmed tasks from unresolved medical instructions.

Four flagship journeys define the product: **promise ledger**, **family-care handoff**, **speak-to-fill forms** and **household bilingual captions**. Promise ledger ships first, followed by nonclinical care handoffs and one maintained form-template pilot; bilingual captions follow independent translation qualification. Engineering prompts remain an advanced export through SPE's existing compiler. Competitive novelty and willingness to pay need separate research.

## 2. Preserve what SPE already owns

Reference MM candidate: `1053b9ca46d5e7749d259cdbfa7e49c9fa9195f8`, branch `antigravity/spe-task-continuation-v1-20261001`, worktree `/Volumes/4TB-WD/spe-worktrees/spe-task-continuation-v1`. Reviewed MM base resolves to `535903e71f61343da9dfe8a0cc798e65513a683d`.

For that candidate, preserve `spe_wasm.wasm`: **1,340,112 bytes**, SHA-256 `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`. These are review measurements, not a new implementation run. Recapture before implementation because other branches have different state.

| Existing owner | v2.1 responsibility |
|---|---|
| SPE deterministic WASM, K3/XCAT/Quality | Compile protected intent using the existing callable interface |
| Existing screenshot observation IR | Receive additional recognized text and geometric observations |
| Existing video sampler/decode owner | Supply bounded keyframes/audio with container-relative timing |
| Existing framework adapters, WebsiteSpec/compiler and comparator | Emit, render and measure their established targets |
| Existing vision classifier | Continue its ImageNet subject-classification role |
| Existing Tier-0 OCR | Discover likely text regions without claiming recognized words |
| Existing continuation/evidence owners | Review claims, expose gaps and export next-task data |
| Gilden | Execute only under its existing external authority |

The new work uses these interfaces. It does not reimplement their semantics. Preserve I1 unchanged; do not start I2; leave canonical WASM, pin/build tools and user changes intact. No merge/deploy/host/release authority follows from a prompt or receipt. Missing owner integration is resolved with a scoped adapter handoff, not a parallel compiler.

## 3. Make the size strategy explicit

The original all-in requirement remains **all required decoded distribution assets <25,000,000 bytes**. It includes neural weights, tokenizers, dictionaries, runtime WASM/JS, workers, shell, renderer and exported supporting assets. Lazy loading changes startup timing; it does not erase bytes from this total. Installed union and duplicate stored copies are measured separately.

**Proposed practical architecture:** a compact core with optional local capability packs. This is an explicit revision of the deployment profile, **not compliance with the original all-in limit**. It makes real multilingual local inference deliverable while preserving zero server inference fees and an efficient initial experience. The original ALL25 target continues as a separate research experiment.

| Profile | Contract | What it provides |
|---|---|---|
| CORE25 | Base decoded client distribution <25,000,000 bytes; target ≤20,000,000 for margin | Frozen compiler, accessible record/action workspace, text/touch input, Tier-0 observations, exports |
| LOCAL-PACKS | Installed total = core plus explicitly selected model/runtime packs; display actual sizes | Qualified ASR/OCR and separately qualified translation/spoken output, offline after provisioning |
| ALL25 research | Entire declared feature profile <25,000,000 bytes, with quality retained | Compression experiment; no compliant model set is presently selected |

CORE25 deliberately excludes ORT/model weights from its base definition. The UI must say “core size” whenever referring to that figure. A core satisfying CORE25 never earns an ALL25 badge.

The review measured an existing distribution at 30,953,226 raw bytes, including two 11,246,032-byte ORT WASM copies. Removing one safely could save 11,246,032 bytes in that existing distribution, but no fresh output or safe removal has been demonstrated. Correct the build graph and cache references under the runtime/build owner's scope; verify cold and warm paths before eliminating an artifact.

Budget ledger for every profile records: decoded assets, actual HTTP transfer with response encoding, installed origin storage, peak process/JS/WASM memory and observable GPU allocations. Count translation, speech synthesis, obligation extraction, multilingual fonts and any clip-rendering codec assets explicitly. RAM is never inferred from model download size. The frozen prompt WASM is not the ONNX inference runtime. Worldwide capability is achieved through a declared pack catalog, not a fictional universal 25 MB model.

## 4. Five deep modules, one public processing interface

Use a small interface with substantial implementation behind it. Callers should not manage graph shards, preprocessors or backend negotiation themselves.

```text
User media
  → local decode and bounded sampling
  → PerceptionJob module
      ↳ ModelPack module: consent, provenance, integrity, storage
      ↳ RuntimeSession module: worker, tensors, backend, cleanup
  → EvidenceProjection module: source spans, observations, revisions
  → OutcomeComposer module: editable promise / handoff / form / caption records
  → user confirmation and accessible readback
  → user-selected export or confirmed action adapter
      ↳ existing ProtectedIntent / SPE compiler for prompt exports
```

Existing render/emitter/comparator modules handle screenshot and scene outputs through their established interfaces. They are not wrapped with a second independent implementation.

Conceptual public interface:

```typescript
type PerceptionRequest = {
  input: LocalMediaHandle;
  task: "speech" | "text-recognition" | "video-index";
  packId: string;
  signal: AbortSignal;
};

// LocalMediaHandle refers to local bytes; it is not an upload URL.
// Ground-truth transcripts and expected boxes are not accepted.
run(request: PerceptionRequest): AsyncIterable<JobEvent>;
cancel(jobId: string): Promise<void>;
dispose(): Promise<void>;
```

This is a proposed interface, not code already implemented. Use existing job/lifecycle concepts where they already satisfy it. ASR and OCR adapters share provisioning/session management but retain task-specific preprocessing and decoding. Introduce adapters where backend behavior actually varies, rather than adding interchangeable abstractions without a real need.

## 5. Repair every current defect with an executable design

| Defect | Concrete repair | Acceptance evidence |
|---|---|---|
| Empty/patterned hashes and mutable expectations | Immutable manifests from pinned upstream revisions; recompute every file hash; canonical manifest digest; application-controlled trusted catalog | Different/corrupt bytes rejected; observed digests match independent computation |
| Synthetic 64-byte installer | Real explicit download or offline import; stage, verify, then atomically publish pack | Interrupted import leaves no usable partial pack; installer never rewrites expected hashes |
| ASR returns supplied answers | Worker-owned actual inference and tokenizer decoding; remove production answer override | Two equal-sized different recordings produce different content-dependent outputs; bypassed inference fails |
| OCR returns labels/UI placeholders | Detector/crop/recognizer/dictionary pipeline; ground truth confined to scorer | Real pixels recognized on unseen fixtures; missed boxes counted as errors |
| Static QUALIFIED matrix | Qualification records keyed by pack digest, runtime build, backend and exact environment | Feature probe alone cannot qualify; receipt records executed provider |
| Metadata-only media hashes | Hash original bytes and canonical decode/preprocess parameters | Same-shaped different content has a different input identity |
| Invented timing/memory | Observed counters/timestamps with units, source and coverage | Missing counters remain unavailable; metadata cannot populate a measured field |
| Simulated rendering and score increments | Render emitted candidate through existing target owner; compare actual pixels every iteration | Changed code must change artifact identity; scores independently reproduce |
| 3D CDN and compile-only success | Package renderer; execute export offline; measure interactions and cleanup | Clean offline profile renders and interacts; compile status distinct from executed status |
| Heuristic bands become video text | Preserve observation type through fusion | ROI-only output never becomes recognized ON_SCREEN_TEXT |
| Regex changes source evidence | Immutable original plus safe derived display; typed data-to-intent interface | Injection cannot alter authority; edited display does not overwrite source |
| Literal privacy zero | Enforced network policy plus scoped transport observation | Deliberate forbidden network attempt detected/blocked; receipt lists observer limits |

These are implementation repairs specified by the plan. They have not been applied to production source in this rewrite.

## 6. Select real models by experiments

Begin with a working baseline before compression. Evaluate `onnx-community/moonshine-tiny-ONNX` INT8 for English and `onnx-community/whisper-tiny` INT8 for multilingual speech. Neither is preselected as winner; qualify the exact graph set, variant and browser runtime.

Current published Moonshine INT8 encoder and merged decoder total approximately 28.12 MB before tokenizer/config/runtime. Its q4 pair is approximately 55.4 MB. This illustrates why a bit-width label cannot determine package size. Loader choice may require additional decoder files. Pin the full revision and measure downloaded bytes before selection. [Upstream files](https://huggingface.co/onnx-community/moonshine-tiny-ONNX/tree/main/onnx)

Use a global language/domain/accent matrix rather than an India-first matrix. English-specific Moonshine is a baseline comparator; the consumer architecture evaluates multilingual ASR candidates. Existing G12 native reports and fixtures remain useful historical comparators through their owners; they neither set the product geography nor qualify browser execution. Segment timestamps, word alignment, speakers and translation each require a supporting method. Use coarse evidenced segments initially; leave unavailable word/speaker fields absent rather than synthesizing precision.

OCR selection identifies a detector and language/script recognizer(s) with their actual dictionaries. Qualification covers Latin, Arabic, Cyrillic, Han, Japanese, Hangul, Devanagari/Bengali, Thai and other scripts needed by the worldwide catalog. Validate mixed scripts and document-specific names, dates, quantities and units. Paddle's upstream tables expose separate recognizers; do not assume one tiny model contains all scripts. INT8 export, calibration and browser operator support are separate experiments. [Recognition models](https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/docs/version3.x/module_usage/text_recognition.en.md)

Reuse deterministic geometry for the initial UI layout path. Add a UI-trained segmentation head only if held-out reconstruction results show a material benefit. Retain the existing ImageNet model's role.

Every model record includes upstream revision, exact files/bytes/hashes, weight and code licenses, notices, training/adaptation lineage where available, export/quantization versions, calibration rights, input/output schemas, operators/dtypes, tokenizer/dictionary revisions and evidence references. Moonshine variants have license differences; inspect the exact variant, not the family name. [Upstream license](https://github.com/moonshine-ai/moonshine/blob/main/LICENSE)

## 7. The ALL25 compression laboratory

Run this outside production imports. Its output is a reproducible candidate artifact, measured quality and a size/latency tradeoff curve.

Compare at least these twelve hypotheses:

| Experiment | Expected contribution / elimination test |
|---|---|
| E1 shared runtime | Avoid duplicated ORT assets; count actual distribution and stored union |
| E2 lazy optional packs | Improve initial loading; cannot reduce original all-installed total |
| E3 INT8 vs q4 vs mixed precision | Select by bytes, operator support and accuracy rather than bit-width |
| E4 shared decoder weights | Reduce duplicated exports; prove equivalent decoding and browser execution |
| E5 reduced-operator runtime | Shrink ORT; retain every required operator and compatible worker/backend |
| E6 task-specific distilled ASR | Explore smaller checkpoints; training/compute cost separate from inference fees |
| E7 vocabulary/tokenizer reduction | Explore narrower task/language scope; test names, code and rare words |
| E8 script-specific OCR | Reduce per-profile footprint; disclose separate installed-language totals |
| E9 unified OCR distillation | Compare actual multilingual quality against separate recognizers |
| E10 deterministic layout | Avoid an unnecessary neural layout model; evaluate rendered fidelity |
| E11 procedural scenes | Avoid 3D asset downloads; include renderer/shaders and export overhead |
| E12 streaming/chunked execution | Bound working memory; measure overlap, long-media errors and timing |

Prioritize E1/E3/E10/E11 for straightforward engineering gains. E4/E5 require runtime/export expertise. E6/E7/E9 are research, with uncertain quality and compute costs. E2/E8 define useful profiles but do not solve the original universal all-in budget. E12 solves working-memory pressure rather than weight storage.

After each experiment record actual byte savings, quality delta, memory/latency delta, device compatibility and maintenance cost. Eliminate candidates that save bytes by dropping required scripts or replacing real inference with heuristics. An ALL25 result is named by its precise supported feature/language set; an English-only experiment cannot stand in for the original multilingual requirement.

## 8. Local runtime that stays responsive

Provision with explicit user action: show download bytes, installed-space requirement, languages and device qualification before acquisition. Stage files, verify integrity, then expose a read-only verified pack handle. Model sessions use those verified bytes rather than refetching by an unrelated URL.

Use a dedicated worker and correct backend import. ONNX Runtime's proxy worker does not support WebGPU, and WASM multithreading requires cross-origin isolation. Start with a reproducible single-thread WASM path, then qualify WebGPU and threading independently under existing CSP. [Runtime documentation](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)

Decode via existing media owners; normalize channels/sample format, filter resampling, and maintain source clock offsets. Limit one heavy perception job initially, with a bounded queue and cancellation. Stream bounded transcript chunks; sample frames under the existing video budget; unload sessions on pack eviction. Test GPU device loss, worker termination and navigation cleanup. Offline warm use needs all dependencies cached; show repair/import choices after eviction rather than claiming permanent cache residency.

## 9. Evidence that survives edits

Each observation records source digest, time interval or image box, producing model/runtime digest, actual backend, processing revision and evidence kind. Confidence is optional and calibrated where used. Recognized text is untrusted data even when accurate.

Each requirement links to observations and has one of four useful states: source-supported, user-confirmed, proposed inference or missing evidence. These are product explanations mapped onto existing SPE evidence laws, not replacement K3 semantics. No averaged confidence score promotes a weak claim to fact.

User corrections retain the original and add an attributed correction. Derived task/prompt artifacts record the source/evidence revision; changed dependencies mark them stale. Sensitive intermediate media stay in memory by default; persistence is explicit and removable. Receipt exports avoid unnecessary raw-media inclusion.

Network protection separates provisioning from inference. Local sessions prohibit media/prompt network transport; instrument the page, worker, service worker and preview surfaces. A privacy receipt records observed bytes, blocked attempts, observer scope and unavailable browser-service coverage. A hash protects report integrity; it does not prove universal absence of leakage.

## 10. Ten worldwide outcome packs

| Pack | User outcome and first method | Expansion / commercial hypothesis |
|---|---|---|
| 1. Spoken promise ledger | Confirm who said what, to whom, by when and under which conditions; link each field to its source | Personal/microbusiness ledger; no automatic legal enforceability conclusion |
| 2. Marketplace dispute pack | Buyer/seller timeline: promises, payments, delivery claims, messages, unresolved discrepancies | Portable redacted evidence pack; marketplace integration later |
| 3. Family-care timeline | Organize care calls, appointments, pickups and source-attributed advice into decisions and next steps | Family subscription; clinician-facing handoff letter, hospital partnership later |
| 4. Caregiver handoff | One-minute voice update becomes status, completed actions, next tasks and unresolved questions; read back to sender | Family/shift handoff; permissioned team workflow later |
| 5. Medicine instruction organizer | Photo plus voice becomes a proposed reminder record from an existing verified instruction, with explicit critical-field confirmation | Confirmed calendar export first; reliable native alarms later |
| 6. New-parent mental-load organizer | Sort a spoken dump into feeds, appointments, purchases, user-confirmed medicines and outstanding tasks | Household plan; no invented medical or developmental advice |
| 7. Speak-to-fill forms | Ask one field at a time in the user's language; read back answers; map to a versioned authoritative form | Benefits/ID/loan-document preparation; institution licenses later |
| 8. Household bilingual captions | Original speech plus translated captions with linked spans and clear speaker uncertainty | Family/classroom/community use; separately qualified language pairs |
| 9. Post-scam incident pack | Capture an account quickly; attach messages/payment records; separate allegations, observations and unknowns | User-controlled narrative/evidence export; official jurisdiction-specific next steps |
| 10. Creator clip mine | Long owned audio/video → up to 20 candidate cuts ranked by a transparent hook rubric, with original time ranges | Batch creator workflow; render/export and feedback-calibrated ranking |

Priority: promise ledger → nonclinical family handoff → one speak-to-fill pilot → qualified bilingual captions. Creator clip mining and dispute/post-scam packs reuse the timeline and export modules. Engineering, study and meeting prompt exports remain advanced uses of the existing compiler, not competing flagship launches. Reuse one evidence projection. Free-form extraction, translation, spoken synthesis and semantic ranking each need their own evaluated method/model budgets. Exporting an SPE prompt is not local completion by an LLM. Cloud execution is not silently added. Revenue models are hypotheses, with no invented prices or demand estimates.

## 11. Screenshot reconstruction and procedural 3D

Screenshot path: original pixels → actual OCR plus deterministic geometry → existing screenshot IR → existing target adapter → real render → viewport-matched screenshot → independent comparator → at most three repair cycles. Score each fresh render; bind receipts to emitted code and screenshot bytes. If score improvement stops, show the current result and mismatches so the user can make a useful correction.

Default verification begins with an existing browser-renderable target. SwiftUI/Compose/Flutter/native targets require their actual target toolchains and rendering evidence; never award all-target fidelity from a single browser output.

Scene path extends the existing scene/website owner: procedural geometry, bounded lights/materials, camera, scroll tracks, interactions, performance budget and accessible alternative. Package the approved renderer rather than fetching a CDN at runtime. Budget triangles, DPR and frame time as configurable constraints; test context loss and dispose geometries, materials, textures and renderers. Reduced motion uses a meaningful static view, and keyboard users can access all essential information.

## 12. Voice is the default interface

Open with “What do you need help organizing?” and four large choices: **A promise**, **Family care**, **A form**, **Understand together**. Offer tap-to-talk, importing and typing without requiring account creation for a local draft. Stop listening visibly; no default always-on microphone. Provide short spoken instructions, optional captions and a replayable example in the selected language.

The conversation has four turns: capture → short readback → one clarification at a time → confirmed record. Users can say “change the date,” “repeat,” “cancel,” “show the original,” or “that's wrong.” Voice commands are accepted only inside the active command state, separate from imported recordings. Imported words cannot execute navigation, sharing or alarms. Critical dates, amounts, identities and medicine instructions receive field-level confirmation with a nonvoice alternative.

Use progressive cards: **What happened**, **What is next**, **Why SPE thinks so**. The advanced Source/Evidence/Record workspace remains available, but users never need to inspect it to finish a basic handoff. Make confidence understandable: “I could not hear the amount clearly” is more useful than “0.63.” Do not require reading a transcript to correct it.

ASR alone does not make a spoken interface. Spoken readback uses separately qualified local TTS or recorded prompts. Device speech synthesis is allowed only after confirming its actual local/offline behavior; otherwise label the mode and use touch/text. Bilingual output needs translation qualification separately. Display pack downloads and storage choices in plain language, with audio guidance where qualified. Engineering details live in an expandable receipt.

Use visible and accessible names that agree so speech-input users can identify controls. Short labeled steps, validation, undo and confirmation follow the [W3C forms guidance](https://www.w3.org/WAI/tutorials/forms/) and [Label in Name criterion](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html). Test with people who have low literacy, limited dexterity, visual/hearing impairments, noisy workplaces and shared phones; do not assume one mode serves everyone.

Preserve existing SPE visual motifs and dotted atmosphere. Use native restrained motion to connect source selection to evidence and task changes; respect reduced motion, light/dark, keyboard focus, screen-reader descriptions and readable contrast. Avoid decorative animation that obscures readiness. An award submission, if desired later, should include an actual accessible rendered demonstration and measured user study rather than a visual mock alone.

## 13. Implementation sequence and ownership

These waves describe future implementation authorized separately from this document rewrite. Routine reversible choices are made within the wave's file allowlist; unresolved model/device evidence becomes a targeted experiment while independent work continues.

| Wave | Deliverable and responsibility | Completion proof |
|---|---|---|
| W0 custody | Architecture owner maps existing interfaces/protected files; exact candidate inventory | Clean isolated candidate; protected digests captured; concrete allowlist |
| W1 truth and integrity repair | MM owner removes answer injection, fabricated metrics/status and mutable installer expectations | False-qualification probe fails to qualify; integrity/receipt mutants killed |
| W2 real multilingual speech and readback | Runtime/media owners deliver decode→tensor→session→tokens plus qualified spoken prompts/readback; English baseline is a comparator | Unseen speech in initial qualified languages; independent scorer; offline/abort; corrected critical fields |
| W3 global OCR and language seams | Runtime/perception owner delivers actual script recognition and independent translation/TTS catalog | Pixel-only recognition; script-specific references; language-pair and spoken-output evidence |
| W4 first complete promise journey | Existing evidence owners map speech to user-confirmed ledger records and existing export/compiler interfaces | Spoken promise → critical-field readback → correction → source-linked ledger/export |
| W5 reconstruction/scene execution | Existing renderer/adapter owners replace simulated measurement and package scene runtime | Actual render comparisons; offline scene export/interactions |
| W6 care/forms/captions and clip experiments | Existing media/evidence owners extend handoffs, versioned forms, bilingual timing and candidate cuts | Correct obligations/form fields; human translation review; real demux; confirmed scheduler/export behavior |
| W7 compression and independent qualification | Runtime research plus separate verifier | Profile byte ledger; held-out replication; exact release candidate evidence |

Dependency order: W0→W1→W2→W4 for the promise ledger; OCR is required when images supply evidence but not for a speech-only ledger. W3 adds document/translation/spoken-output coverage; W6 extends the same evidence modules. Screenshot/3D W5 remains an advanced parallel capability under existing owners and does not delay the worldwide voice journey. Compression experiments can proceed independently. Ownership mapping never authorizes modifying protected compiler internals.

For W1, start from the reviewed repair allowlist: MM module, MultimodalFabricInspector, MM tests and new proof files. Other owner changes receive their own narrowly scoped wave rather than expanding this list implicitly. Keep the original source and evidence branch recoverable; changes are incremental.

## 14. Ten measurable objectives

All thresholds below are proposed acceptance criteria, not observed results. Freeze them before scoring; improve the implementation when it misses them.

| Objective | Criterion and measurement |
|---|---|
| 1. Real perception | No labels/references enter inference; recorded session execution; unseen input perturbations alter outputs appropriately |
| 2. Integrity | Every used artifact binds to immutable expected bytes/hash; all corruption and manifest-substitution mutants rejected |
| 3. Compactness | CORE25 <25,000,000 raw decoded bytes; ≤20,000,000 design target; ALL25 reported separately |
| 4. Ordinary ASR quality | Proposed WER≤0.20 per advertised language/domain on lawful held-out human data; corpus-weighted counts and uncertainty |
| 5. Ordinary OCR quality | Proposed CER≤0.15 per advertised script/domain; detection precision/recall and box IoU reported independently |
| 6. Responsiveness | Progress/cancel UI remains operable; proposed no inference-attributed main-thread task >50 ms on qualified devices |
| 7. Live captions | RTF<1 plus proposed p95 caption delay≤2 s on each claimed live device; do not transfer batch qualification |
| 8. Action fidelity | Every source-supported record field links to the correct span; exact dates/amounts/units and conditional obligations verified; dependency edits mark outputs stale |
| 9. Render fidelity | Actual SSIM≥0.85 and structure≥0.80 proposed for named target/viewport; independent render comparator; ≤3 repairs |
| 10. Trust and global access | Scoped egress/offline proof; keyboard/screen-reader/reduced-motion/RTL; spoken correction and readback; translated critical fields evaluated per pair |

Generic WER/CER thresholds do not certify high-consequence outputs. Evaluate clean/noisy speech, quiet audio, names/numbers, currencies, timezones, negation, conditional promises, accents, mixed language, long media, tiny UI text and dark/mobile documents separately. Exact critical-field accuracy and false-obligation rates matter alongside transcription errors. References missing → metric unavailable. Confidence intervals and sample coverage determine how broadly results may be described. Evaluate translation omission/negation/number preservation with bilingual human reviewers; do not use only a generic automatic translation score.

Test pack × runtime build × dtype × backend × device/browser version. Include Chrome macOS/Windows/Android, Edge, Firefox and Safari macOS/iOS; untapped cells remain untested. Record JS heap, WASM memory, process RSS, observable GPU allocations, origin storage, thermal/system pressure and repeated-job cleanup separately.

## 15. Verification, rollback and exact handoff

Use the existing MM-Q1R packet's artifact/dataset/receipt/network/device/mutant structure. Expand it with the v2 profile ledger and end-to-end task-brief evidence. Separate fixtures from scorer references; no expected transcript or boxes in production request types. Replicate scoring with an independent implementation at the exact candidate SHA.

Minimum mutants include: accepted corrupt/missing models; changed expected hashes; manually READY pack becoming qualified; answer leakage; disconnected session.run; content-insensitive input hash; stale receipts; synthetic fidelity; false backend; literal privacy zero; ROI promoted to OCR; spoken/OCR instructions changing authority; abort/context loss leaving resources; repairs exceeding three.

Rollback disables the new adapter at its existing feature seam, restores the known Tier-0/text-only path and preserves user documents/evidence revisions. Do not reset user changes or alter frozen compiler semantics. Cached packs are evicted by exact version/digest with explicit storage controls; a stale pack never silently substitutes for the selected one.

Handoff files: custody/owner map, profile manifest, model provenance, held-out dataset manifest, raw execution receipts, independent metrics, rendered artifacts, scoped network traces, device matrix, mutant results, usability observations and final per-capability report. Quality failures include the next repair experiment, its input, owner and acceptance proof so work remains actionable.

The immediate implementation packet is **W0/W1 plus an isolated W2 multilingual ASR and spoken-readback experiment**, followed by the first promise-ledger journey. Use English plus Spanish as proposed first qualification slices, with Arabic added early to exercise RTL and a different script; initial slices are engineering sequencing, not the worldwide product's final coverage. Qualification results may change model choice, not justify silent promises of unsupported languages. The product grows through shared modules and maintained language catalogs.

## 16. Research-to-product trace

The requested 20-step method is applied as a design workflow: mission/decomposition/evidence plan (sections 1–3); foundational/current sources and contradictory artifact evidence (sections 3, 6–7 and prior review); full-source/method checks (prior custody and false-qualification probe); claim/evidence/contradiction/unknown mapping (repair table and profile ledger); twelve hypotheses and elimination (section 7); surviving choices/uncertainty (CORE25 proposal and ALL25 laboratory); prototype/measured proof (waves W2–W7); independent repetition and product integration (sections 14–15).

Research/prototype steps specified for future implementation remain future work; no finished evidence is implied. Read the source-backed [review](../reviews/spe-pro-maxx-2026-10-01/REVIEW.md) and [qualification packet](../reviews/spe-pro-maxx-2026-10-01/NEXT_PACKET.md) for the exact defects and provenance inventory underpinning this rewrite.

## 17. Worldwide language catalog

Replace the earlier local-language emphasis with an expandable global catalog. The following is a proposed broad starting catalog, not a claim that every capability is implemented or a ranking of the world's languages:

| Catalog group | Languages to evaluate |
|---|---|
| International and Americas | English, Spanish, Portuguese, French, German |
| Additional European coverage | Italian, Dutch, Polish, Russian, Ukrainian |
| Middle East and East Africa | Arabic, Turkish, Persian, Hebrew, Swahili |
| South Asia and Indonesia | Hindi, Bengali, Urdu, Punjabi, Indonesian |
| Southeast Asia and Japan | Malay, Vietnamese, Thai, Filipino, Japanese |
| East Asia and additional African coverage | Korean, Mandarin Chinese, Cantonese, Hausa, Amharic |

Add further widely used languages through the same catalog. This global mix includes major languages spoken in South Asia without making one country or region the product center. Evaluate Portuguese variants, Spanish variants, Arabic dialects and other varieties independently where advertised; a language-family label does not prove all accents/dialects. Mandarin and Cantonese are distinct speech targets; Simplified/Traditional Chinese are separate writing configurations.

Each catalog row has independent cells for **interface translation, speech recognition, OCR, translation into/out of the language, spoken replies, offline operation and qualified devices**. Store exact model/runtime digests and evidence IDs per cell. The translation matrix is directional: English→Arabic does not prove Arabic→English, and either does not establish Spanish→Arabic.

Users choose their speaking language, output language and locale independently. Country does not determine language. Language detection is a suggestion with explicit correction, especially for short clips/code-switching. Preserve original-language transcripts and links when adding a translation. Missing recognition can still allow a localized interface and user-supplied text, with an honest explanation.

Support RTL and mixed-direction text, locale-sensitive dates/calendars, currencies, decimal separators, timezones, pluralization and names. Ask about ambiguous “Friday,” “fifty” and numeric dates rather than guessing. Currency conversion and benefits/legal rules are not inferred from UI language. Count required fonts and transliteration assets in the budget.

Translation/TTS/obligation extraction are distinct capabilities. Do not select a model because it advertises many languages. For example, NLLB-200-distilled-600M is labeled CC-BY-NC-4.0 and described as a research model; it is not a default commercial dependency for this product. Select a commercially usable, browser-compatible candidate only after exact variant/license, graph/bytes and pair-specific quality review. [Model card](https://huggingface.co/facebook/nllb-200-distilled-600M)

## 18. Shared records: from words to confirmed obligations

Extend existing evidence/continuation interfaces with domain records; do not duplicate K3 semantics or create an autonomous execution owner. All records preserve the speaker's original claim and the user's correction separately.

```text
SourceSpan: source_digest, media_offset/box, original_text, language,
            producing_model/runtime, observation_revision

PromiseRecord: actor, recipient, action, object, quantity/unit/currency,
               due_at/timezone, condition, modality, acceptance,
               linked_source_spans, field_confirmation, record_revision

CareHandoff: subject_alias, author, observed_at, reported_status,
             completed_actions, next_tasks, unresolved_questions,
             instruction_sources, acknowledgement

FormDraft: issuing_authority, jurisdiction, form_id/version/source,
           field_values, source_links, readback_confirmations,
           missing_fields, attachment_inventory

CaptionPair: original_span/text, translated_text, source/target_language,
             translation_revision, uncertainty, display_timing
```

Extraction may use deterministic candidate patterns or an evaluated local extraction model. Patterns supply suggestions; they do not constitute universal multilingual understanding. User-guided slot filling with localized readback provides a viable first method before automatic extraction qualifies in every catalog language. Count any extraction model and dictionaries separately.

An obligation record distinguishes commitment, proposal, request, estimate, reported claim and completed action. “I might come Friday” is not a confirmed appointment; “if the part arrives” is a condition; “he said he would pay” is a reported claim, not authenticated agreement. Speaker identity requires user attribution or separately qualified identification; ASR does not authenticate people.

Hash-based integrity receipts show whether saved bytes changed. They do not establish legal admissibility, authenticity of a recording, consent to recording, identity or enforceability. The promise ledger exports source-backed claims and acknowledgements; it does not advertise “mathematical proof of a legally binding promise.” Recording/import/sharing controls and country-specific notices require a maintained jurisdiction policy. No background interception of calls or private chat accounts.

## 19. Detailed flagship and extension workflows

### A. Promise ledger and marketplace dispute

Capture a permitted voice note/message and optionally invoice/payment/delivery records. Extract candidate fields, clarify identity/currency/date/conditions, read them back and save only user-confirmed fields as confirmed. Allow optional counterpart acknowledgement through explicit sharing. Export a timeline containing exact quoted spans, confirmations, disputed statements and missing evidence.

For “promised versus delivered,” show two evidence columns. A payment receipt alone does not prove delivery, and absent delivery evidence does not prove nondelivery. Include author/source/time attribution, original-file hashes, safe redaction previews and an attachment manifest. User allegations stay attributed. No automated messaging, dispute filing or legal verdict.

### B. Chronic-care and caregiver handoff

Organize family voice notes, appointments, lab-document attachments and pharmacy tasks into one timeline. Separate clinician instructions, patient/family reports and relatives' suggestions. Do not interpret lab results, resolve conflicting medical advice or recommend diagnosis/treatment. The useful first output is “what was reported, what was decided, what is next, what needs clarification.”

A one-minute night handoff creates a morning brief with sender readback and recipient acknowledgement. Pending acknowledgement remains visible. A clinical handoff letter is a draft with source attribution and unresolved discrepancies for the receiving professional. WHO identifies medication discrepancies during care transitions as a safety concern; that supports explicit reconciliation and source preservation in this design, not an automated-care claim. [WHO report](https://www.who.int/publications/i/item/WHO-UHC-SDS-2019.9)

Store health media locally by default. Sharing requires a deliberate recipient/attachment selection and redaction preview. Family collaboration first uses user-controlled exported records; hospital white-label or synchronized family access needs separate identity/access, consent, retention, hosting and jurisdiction review. No advertising on sensitive care records.

### C. Medicine photo plus voice → confirmed reminder

Read an existing prescription/label and capture the user's explanation. Preserve both sources. Require reconciliation against the current verified instruction and confirmation of medicine identity, formulation/strength, dose/unit, route, frequency, start/end, food instruction and recipient as applicable. Highlight conflicts, uncertain OCR and missing instructions. If the instructions conflict or cannot be verified, produce a clarification checklist rather than an active medicine schedule.

“Twice after food” does not determine a dose or justify inventing two exact times twelve hours apart. Proposed clock times must follow the verified instruction and be confirmed by the user/caregiver; medication questions go to the responsible clinician/pharmacist. The product organizes an existing regimen; it does not prescribe or change it.

Before activation, read back the confirmed schedule in a qualified language and show an accessible review alternative. Ordinary daily task reminders and critical medication reminders are different risk tiers. First release exports a confirmed calendar/reminder draft. A browser-only notification flow must not promise an alarm while closed or suspended; reliable background alerts require a separately qualified OS/native scheduling adapter, permissions, timezone/DST/reboot tests, delivery acknowledgement and failure indication. Such an adapter receives its own scope and authority; this plan does not modify I1/I2 or grant execution permissions.

### D. New-parent mental-load organizer

Capture a free-form spoken dump and propose categories: feeds, appointments, household supplies, confirmed care tasks and follow-ups. Distinguish recollection from a confirmed event and “I am worried about X” from an action instruction. Overdue status requires a confirmed deadline. Do not invent feeding, developmental or medication advice. Ask one small question at a time; allow “leave that for later.”

### E. Speak-to-fill benefits, identity and loan forms

Start with one maintained template from an authoritative issuer in a specific jurisdiction, rather than claiming universal government coverage. Read questions in the user's chosen language, capture short answers and map only confirmed fields. Keep issuer wording and explanatory translations distinct. Preserve ID/name/amount strings exactly; ambiguous values remain unresolved.

Each template carries issuer URL, form ID/version, jurisdiction, retrieval date, required fields, allowed formats and attachment rules. Source changes invalidate outdated mappings. The final draft exposes missing fields and review steps without deciding eligibility, signing declarations or submitting an application automatically. Offer filled PDF/data export where supported and a source-linked answer sheet otherwise. Test with users who need spoken assistance; measure completion and correction rates rather than transcript length.

### F. Household bilingual captions

Use local ASR plus separately qualified directional translation. Display original and translated captions, a correction/replay control and uncertainty where names/numbers are unclear. Do not conceal the original behind a fluent translation. Qualify chunk boundaries, negation, names, critical numbers and caption delay per language pair and device. Original-language captions remain useful when translation is unavailable. Translation into speech has additional TTS latency/quality criteria.

### G. Creator clip mine

Import creator-owned/permitted long media, transcribe and detect candidate boundaries. Rank **up to 20** cuts by an inspectable rubric: opening clarity, standalone context, topic specificity, contrast/question/tension, completion of the thought and excessive repetition. Initial ranking can combine explicit user-selected goals and deterministic transcript features; qualified semantic ranking is a separate model capability. The score predicts rubric fit, not guaranteed views or virality.

Keep source in/out times, explain ranking, avoid cutting away negation or qualifications and allow creator adjustments. Export an edit-decision list first. Actual rendered clips/subtitles require a measured local encoder/render path with codec support, bytes, memory and long-job cancellation accounted for. Audio-only input produces audio clips or a clearly labeled generated visual layout; it cannot produce original video footage. Validate ranking through blinded creator preference and later consented outcome feedback.

### H. Post-scam or coercion incident pack

Begin with a short calming capture flow: “What happened?”, “When?”, “What was requested?”, “What did you send or share?” Create an editable chronology with exact source links; separate suspected wrongdoing, reported pressure and directly observed payments/messages. Offer redaction and a safe export without unnecessary account credentials. Do not contact the suspected person, make accusations, submit reports or promise money recovery automatically.

Official next-step links are jurisdiction-specific and reviewed for freshness. The FTC's US advice emphasizes contacting the relevant payment company and acting on exposed information; it cannot serve as a worldwide procedure by itself. Other countries need their own official directories and reviewer ownership. [FTC guidance](https://consumer.ftc.gov/articles/what-do-if-you-were-scammed)

## 20. Worldwide rollout, economics and validation

One shared architecture supports the catalog; release capability slices after evidence rather than displaying an unqualified “all languages supported” badge. The initial multilingual qualification set exercises Latin and RTL flows; extend through additional script/language families and global accents using the same tests. Language selection remains global from the start, with clearly visible availability per capability.

Proposed order:

1. Promise ledger: voice capture, spoken correction, confirmed fields, local save/export.
2. Family handoff: nonclinical coordination, acknowledgements and role-aware sharing drafts.
3. One speak-to-fill jurisdiction pilot: maintained authoritative template and assisted user testing.
4. Household bilingual captions: a small independently qualified pair set, then catalog expansion.
5. Dispute/post-scam packs and creator clip candidates: reuse source timeline/export capabilities.
6. Confirmed medicine organization and reliable scheduling: separate safety/scheduler qualification before activation.

Commercial hypotheses: personal free tier for local records; household subscription for permitted collaboration; microbusiness promise/dispute organization; creator batch workflow; institution white-label deployment. Validate willingness to pay and operational costs through opt-in pilots before selecting prices. Local inference avoids server inference fees; subscriptions, encrypted synchronization and institutional hosting still have costs. Any future synchronization is explicit, opt-in transport with its own privacy policy and budget; it does not inherit the local-only guarantee.

For each flagship, recruit diverse pilot participants across language/script families, accessibility needs and device classes. Compensate and obtain consent for research; do not treat private household/care recordings as a free training corpus. Test completion without keyboard use, spoken correction success, critical-field errors, user comprehension of uncertainty, time to useful output, missed/false obligations and repeat usage. Compare with participants' existing chat/notebook/form workflow. These measurements determine sequencing and product-market fit; presumed suffering alone does not establish demand.

Record a new evidence graph for global claims: capability → exact language/pair/locale → model/runtime/device → dataset/method → observed result → permissible product wording. Contradictory results remain visible; a successful global-language UI translation cannot mask failed ASR or TTS. Existing SPE evidence laws and Gilden authority remain unchanged.

**Design outcome:** a worldwide, voice-first product that turns spoken life into useful, source-linked records and next steps while retaining SPE's existing compiler and authority laws. Production capability is demonstrated through the ten objectives, not assigned a score in advance.
