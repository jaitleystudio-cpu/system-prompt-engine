# Extractable Superdesign Components

## Layout Components

## Nav

- Source: `apps/web/src/layout/Nav.tsx`
- Category: layout
- Description: Fixed global header with product identity, anchor links, responsive menu, and workspace action.
- Extractable props: `scrolled` (boolean, default: false), `view` (`"home" | "workspace"`, default: `"home"`), `menuOpen` (boolean, default: false)
- Hardcoded: Logo component, Create/Explore/Daily/.spe/Open SPE labels, anchor targets, CSS class names, burger strokes.
- Logo note: the source component has a logo position. A later extraction must obey the logo invariant; no durable real logo is selected for WEB-03, so do not create a substitute mark. For the new variations use the complete text identity `SYSTEM PROMPT ENGINE` inline instead of extracting this WEB-02 logo-bearing layout.

## Basic Components

## Logo

- Source: `apps/web/src/brand/Logo.tsx`
- Category: basic
- Description: WEB-02 inline SVG initial mark and accompanying wordmark.
- Extractable props: none for page state; source has visual options `size` and `wordmark`.
- Hardcoded: SPE letterforms, System Prompt Engine text, SVG paths, gradients, metal/cyan/amber colors.
- Extraction decision: do not extract for WEB-03 variation reuse. It is a replaceable WEB-02 identity and no real logo asset has been selected. It remains source context for the mandatory reproduction only.

## PrivacyIndicator

- Source: `apps/web/src/ui/PrivacyIndicator.tsx`
- Category: basic
- Description: Displays online shell state and privacy labels sourced from the current envelope.
- Extractable props: `online` (boolean, default: true)
- Hardcoded: online/offline shell labels, sensitivity/trust/authority labels, `compile: local · no cloud`, CSS classes.
- Extraction decision: skip; the dynamic privacy values are product data and should be represented faithfully in the full draft rather than frozen in a reusable visual component.

## TrustPanel

- Source: `apps/web/src/ui/TrustPanel.tsx`
- Category: basic
- Description: Advanced engine-truth view for the actual worker/WASM path and integrity state.
- Extractable props: none appropriate for static extraction; all visible values are live runtime state.
- Hardcoded: engine path, network mode, not-a-release disclosure, no-fallback and claim-integrity labels.
- Extraction decision: skip; a static template could fabricate proof values and violate the design brief.

## Extraction summary

There is no reusable layout component safe and useful to extract into WEB-03 before draft generation. The only layout, `Nav`, embeds a replaceable WEB-02 initials mark. The new design must not invent a placeholder logo, and current runtime panels are too data-dependent for static component extraction. Pass the source files as context and let each draft represent them within the complete page composition.
