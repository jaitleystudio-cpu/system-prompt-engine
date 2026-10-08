# Task Plan: SPE Free 3D Websites Spec v1.1 Implementation

## Goal
Implement Workstreams A through N for SPE Free 3D Websites Spec v1.1 under frozen RED→GREEN, mutation, privacy, accessibility, performance, originality, agent-authority, and exact-10/10 gates.
Safety Boundary: Do not merge main, deploy Cloudflare, change DNS, spend money, promote production, or disrupt the separate ongoing R8 defect-repair program.

## Workstreams & Phases

- [x] **Phase 1: Canonical Data Models (Workstream A)**
  - Model types: `behaviorGraph.ts`, `motionBlock.ts`, `cameraPlan.ts`, `dataBinding.ts`, `enhancementMetadata.ts`, `agentPolicy.ts`, `runtimeExtension.ts`, `websiteSpecV2.ts`
  - RED test suite & mutation gates (`test-v1-1-models.mjs`)
  - GREEN implementation & schema validation

- [x] **Phase 2: Intent Compilation (Workstream B)**
  - Natural-language compiler for behaviors, cameras, and data: `compileBehaviorIntent.ts`, `compileCameraIntent.ts`, `compileDataIntent.ts`
  - RED test suite & conflict detection (`test-v1-1-intent.mjs`)
  - GREEN compiler implementation

- [x] **Phase 3: Reference Intelligence & Enhancement (Workstream C)**
  - Truthful 3D enhancement analyzer: `analyzeEnhancementOpportunities.ts`, `enhancementTypes.ts`, `EnhancementProposal.tsx`
  - Truth labels contract (`TRUE_3D`, `DEPTH_COMPOSITE`, `2_5D`, `CSS_MOTION`)
  - Originality firewall checks (`test-v1-1-enhancement.mjs`)

- [x] **Phase 4: Inspiration Gallery & Experience Recipes (Workstream D)**
  - Gallery recipes with `BehaviorGraph`, `NarrativeMotionBlocks`, `CameraPlan`, and `ScenePerformanceReceipt`
  - Remix engine regenerating around user identity without copying proprietary brand assets (`test-v1-1-explore-recipes.mjs`)

- [x] **Phase 5: Scene Runtime (Workstream E)**
  - Typed action dispatcher: `executeSceneAction.ts`, `executeCameraAction.ts`, `executeMaterialAction.ts`
  - Zero-eval security guarantee & schema bounds (`test-v1-1-scene-runtime.mjs`)

- [x] **Phase 6: Timeline Engine & Camera Director (Workstream F)**
  - Narrative Motion Blocks expansion and two-way track reconciliation: `expandMotionBlock.ts`, `reconcileMotionBlocks.ts`, `MotionBlockEditor.tsx`
  - Camera Director & collision/clipping guards: `cameraDirector.ts`, `cameraPresets.ts`, `validateCameraPlan.ts`, `CameraDirectorPanel.tsx`
  - Reduced-motion and mobile transforms (`test-v1-1-motion-camera.mjs`)

- [x] **Phase 7: Studio UI & BehaviorGraph Authoring (Workstream G)**
  - BehaviorGraph editor: `BehaviorGraphEditor.tsx`, `BehaviorRuleCard.tsx`, `validateBehaviorGraph.ts`, `executeBehaviorGraph.ts`
  - Studio workspace integration: `WebsiteStudioWorkspace.tsx`
  - Copilot scope chips & cycle refusal (`BEHAVIOR_CYCLE_REFUSED`) (`test-v1-1-behavior-graph.mjs`)

- [x] **Phase 8: Scene Performance Doctor (Workstream H)**
  - Telemetry & measurement: `measureScene.ts`, `scenePerformanceReceipt.ts`, `diagnosePerformance.ts`, `proposeOptimization.ts`, `PerformanceDoctor.tsx`
  - Strict separation of `MEASURED` vs `ESTIMATED` vs `UNKNOWN`
  - Optimization contracts & visual tolerance safeguards (`test-v1-1-performance-doctor.mjs`)

- [x] **Phase 9: Portable Projects & Offline Exports (Workstream I)**
  - `.spe-site` archive packaging and offline roundtrip verification (`test-v1-1-spe-site-export.mjs`)
  - Standalone HTML/CSS/JS export preserving semantic DOM crawlability and SEO

- [x] **Phase 10: Route Gate & Public Copy Policy (Workstream J)**
  - Gatekeeper checks ensuring `/website` Studio route is isolated until qualification
  - Public copy honesty enforcement (no unproven "world's best" claims)

- [x] **Phase 11: Data & Network Boundary (Workstream K)**
  - Data sources and safe transforms: `dataSource.ts`, `dataBinding.ts`, `safeTransform.ts`, `DataBindingInspector.tsx`, `evaluateBinding.ts`
  - Privacy badges (`LOCAL`, `PUBLIC_FETCH`, `EXTERNAL_PROVIDER`) and preflight disclosure (`test-v1-1-data-bindings.mjs`)

- [x] **Phase 12: Quality Repair Loop (Workstream L)**
  - Defect detection & bounded `SitePatch` proposals: `qualityRepairLoop.ts` (`test-v1-1-repair-loop.mjs`)

- [x] **Phase 13: Structured Agent Protocol (Workstream M)**
  - MCP command registry: `commandTypes.ts`, `commandRegistry.ts`, `agentCapabilities.ts`, `validateAgentCommand.ts`, `executeAgentCommand.ts`, `agentReceipt.ts`
  - Capability scoping, `beforeHash` conflict detection, and patch-only mutation invariants (`test-v1-1-agent-protocol.mjs`)

- [x] **Phase 14: Mutation Suite & 10/10 Acceptance Qualification (Workstream N)**
  - Complete mutation kill test suite across all 17 deliberate defect vectors
  - Formal 10/10 qualification report compilation
