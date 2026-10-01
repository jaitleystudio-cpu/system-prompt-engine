# SPE Ω — Website Accessibility Conformance Evaluation Methodology (WCAG-EM) 2.0 Plan

**Target Release:** 2026-10-10 22:10 IST  
**Document Status:** `EVALUATION PLAN & BASELINE SPECIFICATION`  
**Methodology Standard:** [W3C WCAG-EM 2.0](https://www.w3.org/TR/WCAG-EM/)  
**Target Conformance:** Web Content Accessibility Guidelines (WCAG) 2.1 Level AA  

---

## 1. Executive Summary & Governance Context

Under SPE Round-2 Architecture, accessibility evaluation strictly follows the W3C WCAG-EM 2.0 five-step process. In strict adherence to truth-in-engineering principles:
- **Automated Live Browser Qualification is COMPLETE** (`C8_LIVE_BROWSER_AUTOMATED_SCOPE_PASS = YES`).
- **Human Assistive Technology Physical Testing is SCHEDULED** (`WCAG_2_1_AA_HUMAN_AUDIT = PENDING_PHYSICAL_AUDIT`).
- **No Third-Party "WCAG Certificate" is Claimed**, as the W3C does not certify websites; conformance is attested via an ongoing Accessibility Conformance Report (ACR) based on VPAT® 2.5Rev.

---

## 2. Step 1: Define the Evaluation Scope

1. **Evaluation Target:** System Prompt Engine (SPE) Web Application (Single-Page Application built with React 19 + TypeScript + Vite).
2. **Target Conformance Level:** WCAG 2.1 Level AA (including all Level A and Level AA success criteria).
3. **Accessibility Support Baseline:**
   - **Operating Systems:** macOS 15+ (Sequoia), Windows 11 (23H2+), iOS 18+, Android 14+.
   - **Assistive Technologies (AT):**
     - Apple VoiceOver (macOS / Safari & Blink)
     - NVDA 2024.1+ (Windows / Edge & Firefox)
     - JAWS 2024+ (Windows / Chrome)
     - Google TalkBack 14+ (Android / Chrome)
     - Apple VoiceOver iOS (iOS / Safari)
     - Physical Switches & Keyboard-Only Operation

---

## 3. Step 2: Explore the Target Website

The SPE Web architecture consists of specialized operational workspaces and authority pages:
1. **Lane A6-R2: Universal Input Shell:** Multimodal input switcher (Text, Voice, File, Camera), modal dialogs, transcription status banners.
2. **Lane A7-R: Project Library:** Revision grids, card selectors, schema-valid tag filters, search bars.
3. **Lane A8: Workflow Export View:** JSON/YAML display, clipboard copy buttons, download triggers.
4. **Lane A9-R: Authority Hub & Evidence Ledger:** Pillar cards, empirical citation tables, external link security guards (`rel="noopener noreferrer"`).
5. **Lane A11-S: Static Website Builder:** Visual layout previews, responsive viewport switchers (Desktop, Tablet, Mobile), wireframe fallback layers.
6. **Lane A12: Visual Screenshot Workspace:** Side-by-side visual fidelity diff, SSIM/pixel delta telemetry inspector, receipt validators.

---

## 4. Step 3: Select a Representative Sample

WCAG-EM 2.0 requires a structured sample representing all distinct page templates, core user journeys, dynamic interactive states, and error handling paths.

| Sample ID | Workspace / Surface | State / Interaction Type | Key Success Criteria Evaluated |
|---|---|---|---|
| **SMP-01** | Global Application Shell | Initial page load, Skip Link focus | 2.4.1 (Bypass Blocks), 2.4.7 (Focus Visible), 2.1.1 (Keyboard) |
| **SMP-02** | Universal Input Shell (A6) | Mode Switcher Modal Dialog | 2.1.2 (No Keyboard Trap), 1.3.1 (Info & Relationships), 4.1.2 (Name, Role, Value) |
| **SMP-03** | Project Library (A7) | Grid navigation, tag filter selection | 1.4.3 (Contrast Minimum), 2.4.3 (Focus Order), 4.1.3 (Status Messages) |
| **SMP-04** | Workflow Export (A8) | Code snippet copy, export download | 2.1.1 (Keyboard), 2.5.5 (Target Size), 4.1.2 (Name, Role, Value) |
| **SMP-05** | Authority Hub (A9) | External citation link traversal | 2.4.4 (Link Purpose), 3.2.4 (Consistent Identification) |
| **SMP-06** | Static Website Builder (A11)| Viewport resize ($360\text{px}$ reflow, $200\%$ zoom)| 1.4.4 (Resize Text), 1.4.10 (Reflow), 1.4.11 (Non-text Contrast) |
| **SMP-07** | Visual Workspace (A12) | Mathematical SSIM receipt telemetry | 1.3.1 (Info & Relationships), 1.4.1 (Use of Color), 4.1.3 (Status Messages) |
| **SMP-08** | Global Error & Notification | Offline banner, validation feedback | 3.3.1 (Error Identification), 3.3.3 (Error Suggestion), 4.1.3 (Status Messages) |

---

## 5. Step 4: Audit the Selected Sample

The evaluation employs a combined automated-and-manual audit protocol:
1. **Automated Live Browser Scans (Playwright + axe-core):**
   - Ruleset: WCAG 2.1 AA tagset (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).
   - Automated pass rate: $100\%$ of automated checks passing with zero critical/serious violations.
2. **Keyboard Navigation & Trapping Checks:**
   - Full keyboard-only workflow (`Tab`, `Shift+Tab`, `Space`, `Enter`, `Escape`, Arrow Keys).
   - Modal focus containment verified: Focus loops inside open dialogs and restores to trigger element upon closing.
3. **Reflow & Visual Adaptation Audits:**
   - $360\text{px}$ CSS viewport width with $100\%$ zoom: Zero horizontal scroll bars, zero truncated interactive text.
   - $200\%$ and $400\%$ browser zoom: Content reflows into single column.
4. **Motion & Accessibility Preferences:**
   - `prefers-reduced-motion: reduce`: All CSS transitions and keyframe animations disabled immediately.
   - High Contrast Mode (Windows High Contrast / macOS Inverted/High Contrast): Focus rings remain distinct ($\ge 3:1$ contrast against adjacent background).

---

## 6. Step 5: Report Evaluation Findings

1. **Accessibility Conformance Report (ACR):** Documented via VPAT® 2.5Rev WCAG Edition in [ACCESSIBILITY_CONFORMANCE_REPORT_VPAT25REV.md](file:///Volumes/4TB-WD/spe-worktrees/spe-staging-round2-qual/docs/human-perspective/ACCESSIBILITY_CONFORMANCE_REPORT_VPAT25REV.md).
2. **Remediation Tracking:** Any issue identified during human AT trials will be cataloged with WCAG criterion ID, severity, DOM selector, and verified pull request fix.
3. **Attestation Statement:** Formal publication occurs alongside final human physical audit receipts.
