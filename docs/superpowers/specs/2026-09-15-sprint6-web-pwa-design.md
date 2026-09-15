# Sprint 6 Design — Web + PWA Universal Client Foundation

**Date:** 2026-09-15  
**ABI:** `spe.universal-abi.v1` (MAJOR=1 only)  
**Lineage:** `NEW_IMPLEMENTATION`  
**Release claim:** `not_a_release=true`  
**Cost law:** paid API = NO, paid package = NO, new hosting = NO, additional owner spend = ₹0  
**Network:** compile/evaluate `network_mode=NONE`

## Purpose

Ship a local-only Web/PWA client that compiles SPE envelopes through the **actual** Sprint-5 `spe_wasm.wasm` (thin wrapper over `spe-core-rs`). TypeScript is a transport/UI shell only. Python is not on the browser path.

## Architecture

```
User
  → Web/PWA UI (React + TS, session-local)
      → Web Worker
          → SHA-256 integrity check
          → WebAssembly.instantiate(spe_wasm.wasm, {})   # zero host imports
              → spe_evaluate (JSON-in / JSON-out)
                  → spe-core-rs
                      → ABI result
      → structured result panels
```

WASM failure (missing, integrity mismatch, imports≠0, missing exports, instantiate throw) → typed error `ENGINE_UNAVAILABLE` or `WASM_INTEGRITY_MISMATCH`. **No TypeScript semantic fallback. No silent success.**

## In scope

- `apps/web` Vite + React + TypeScript
- Design tokens obsidian / platinum; system fonts only
- Responsive 320–1920; keyboard a11y; `prefers-reduced-motion`; 200% zoom via rem
- Truthful privacy indicator (from envelope labels, never inferred)
- Trust panel (WASM SHA, import count, network NONE, not_a_release)
- PWA manifest + service worker: offline app-shell only; never cache private prompts
- Session-local only: no accounts, no history stores
- Compile UX bound to real worker phases
- Copy on explicit user action
- Typed errors
- Ship release WASM into `apps/web/public/`
- Free test stack (pytest + Node, no paid SaaS)

## Out of scope (hard)

Android, iOS, desktop shells, browser extensions, MCP, AI plugins, Three.js / 3D, ads, billing, deployment, prompt marketplace, analytics, login.

## Privacy / storage law

- Prompts live in page memory only.
- No `localStorage` / `sessionStorage` / `indexedDB` for SPE content.
- Service worker precaches static shell + WASM bytes; GET only; never request bodies.
- Zero analytics / ads / telemetry SDKs.

## Proof posture

Historical Sprint 1–5 RED/GREEN files are immutable. New proofs use `sprint6_*` names only.
