/**
 * UIDrop AI Prompt Compiler
 * Compiles extracted design system tokens into:
 *   1. Natural-language Prompt (matching the exact anti-cloning boilerplate from the UIDrop video)
 *   2. Structured system.md (YAML frontmatter + Markdown implementation rules for coding agents)
 */

import type { DesignSystemSnap } from "../../types/design-system";

/**
 * Derives a human-readable line-height label from numeric ratio.
 */
function getLineHeightLabel(lhStr: string): string {
  const num = parseFloat(lhStr) || 1.6;
  if (num >= 1.8) return "relaxed line-height";
  if (num <= 1.3) return "tight line-height";
  return "balanced line-height";
}

/**
 * Sanitizes input strings against prompt injection, control characters,
 * template interpolations, and YAML/markdown delimiter breakout.
 */
export function sanitizePromptString(input: string | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip ASCII control chars
    .replace(/```/g, "'''") // prevent code block breakout
    .replace(/---/g, "—") // prevent YAML frontmatter breakout
    .replace(/\$\{[^}]*\}/g, "") // prevent JS template literal injection
    .trim();
}

/**
 * Normalizes spatial and token strings to prevent duplicate suffix artifacts.
 */
function cleanSuffix(val: string | undefined, suffix: string): string {
  if (!val) return "";
  const sanitized = sanitizePromptString(val);
  const regex = new RegExp(`\\s*${suffix}s?$`, "i");
  return sanitized.replace(regex, "").trim();
}

/**
 * Compiles extracted design system into the exact anti-cloning prompt template.
 */
export function compileDesignPrompt(snap: DesignSystemSnap): string {
  const {
    classification,
    palette,
    typography,
    tokens,
    layout,
    motion,
    responsive,
    structure,
  } = snap;

  const lineHeightLabel = getLineHeightLabel(typography.bodyDetail?.lineHeight || "1.6");
  const bodyLineHeight = typography.bodyDetail?.lineHeight || "1.6";

  // Clean tokens to prevent duplicate suffixes like "4px grid grid" or "16px cards cards"
  const gridBase = cleanSuffix(layout.gridBase || "4px", "grid");
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const inputRadius = cleanSuffix(tokens.inputRadius || "18px", "input");

  // Format responsive changes as bullet points
  const responsiveBulletsFormatted =
    responsive.responsiveChangesBullets && responsive.responsiveChangesBullets.length > 0
      ? responsive.responsiveChangesBullets
          .map((bullet) => (bullet.startsWith("•") ? bullet : `• ${bullet}`))
          .join("\n")
      : "• at 900px: layout grid collapses to single-column flex";

  return `This is a design system extracted from a webpage I find inspiring. I want to build my own [page/UI] inspired by this design pattern. Do not copy or replicate brand assets, logos, or identity — use these tokens as a foundation to create something original for me.
Match the design language, not the brand.
Theme: ${classification.theme} · ${classification.density}
Rhythm: ${gridBase} grid · ${tokens.buttonRadiusLabel} · ${tokens.shapeLabel} · ${lineHeightLabel} (${bodyLineHeight}) · ${tokens.shadowSummary}
Key colors: Accent: ${palette.primary} | Background: ${palette.surface} | Text: ${palette.text}
Full palette: ${palette.primary} primary, ${palette.accent} accent, ${palette.surface} surface, ${palette.elevated} elevated, ${palette.text} text, ${palette.muted} muted
Typography:
• H1 — ${typography.h1.family} ${typography.h1.size} ${typography.h1.weight}, ${typography.h1.lineHeight} line-height, ${typography.h1.tracking} tracking
• H2 — ${typography.h2.family} ${typography.h2.size} ${typography.h2.weight}, ${typography.h2.lineHeight} line-height, ${typography.h2.tracking} tracking
• H3 — ${typography.h3.family} ${typography.h3.size} ${typography.h3.weight}, ${typography.h3.lineHeight} line-height, ${typography.h3.tracking} tracking
• H4 — ${typography.h4.family} ${typography.h4.size} ${typography.h4.weight}, ${typography.h4.lineHeight} line-height
• Body — ${typography.bodyDetail.family} ${typography.bodyDetail.size} ${typography.bodyDetail.weight}, ${typography.bodyDetail.lineHeight} line-height
• Type scale — ${typography.scale}
Tokens:
• Radius — ${tokens.buttonRadiusLabel}, ${cardRadius} cards, ${inputRadius} inputs
Responsive breakpoints: ${responsive.breakpoints}
Layout grid: max-width ${layout.maxWidth}, ${layout.gutter} gutter
Spacing scale: ${layout.spacingScale}
Motion & hover:
• Hover — ${motion.hoverEffects}
Z-index layers: ${structure.zIndexLayers}
Responsive component changes:
${responsiveBulletsFormatted}
Page structure: ${structure.pageStructure}
(Reproduce the aesthetic Direction when building a full page layout.)
Attach the screenshot from this page as a visual reference — match its hierarchy, density, and overall feel, not just the raw values. Where the brief leaves something underspecified (hover states, focus rings, dark-mode variants), infer sensible defaults consistent with the palette and rhythm above.
This is for my personal project — I'm drawing inspiration from this design pattern to build my own UI. Create something original that follows these design principles without copying the source brand.`.trim();
}

/**
 * Compiles extracted design system into a structured system.md specification
 * with YAML frontmatter and implementation instructions for Cursor, Claude Code, and Antigravity.
 */
export function compileSystemMd(snap: DesignSystemSnap): string {
  const {
    domain,
    url,
    timestamp,
    classification,
    palette,
    typography,
    tokens,
    layout,
    motion,
    responsive,
    structure,
  } = snap;

  const cleanDomain = sanitizePromptString(domain);
  const cleanUrl = sanitizePromptString(url);

  const swatchesYaml = (palette.swatches || [])
    .map((s) => `    - "${sanitizePromptString(s)}"`)
    .join("\n");
  const responsiveChangesYaml = (responsive.responsiveChangesBullets || [])
    .map((b) => `    - "${sanitizePromptString(b.replace(/^•\s*/, ""))}"`)
    .join("\n");

  const gridBase = cleanSuffix(layout.gridBase || "4px", "grid");
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const inputRadius = cleanSuffix(tokens.inputRadius || "18px", "input");

  return `---
name: Design System Specification (${cleanDomain})
extracted_at: "${timestamp}"
source_url: "${cleanUrl}"
domain: "${cleanDomain}"
classification:
  theme: "${classification.theme}"
  density: "${classification.density}"
  shape_profile: "${classification.shapeProfile}"
palette:
  primary: "${palette.primary}"
  accent: "${palette.accent}"
  surface: "${palette.surface}"
  elevated: "${palette.elevated}"
  text: "${palette.text}"
  muted: "${palette.muted}"
  swatches:
${swatchesYaml}
wcag_contrast:
  text_on_surface:
    foreground: "${palette.contrast.textOnSurface.foreground}"
    background: "${palette.contrast.textOnSurface.background}"
    ratio: "${palette.contrast.textOnSurface.formattedRatio}"
    score: "${palette.contrast.textOnSurface.score}"
  primary_on_surface:
    foreground: "${palette.contrast.primaryOnSurface.foreground}"
    background: "${palette.contrast.primaryOnSurface.background}"
    ratio: "${palette.contrast.primaryOnSurface.formattedRatio}"
    score: "${palette.contrast.primaryOnSurface.score}"
  muted_on_surface:
    foreground: "${palette.contrast.mutedOnSurface.foreground}"
    background: "${palette.contrast.mutedOnSurface.background}"
    ratio: "${palette.contrast.mutedOnSurface.formattedRatio}"
    score: "${palette.contrast.mutedOnSurface.score}"
typography:
  heading_family: "${typography.h1.family}"
  body_family: "${typography.bodyDetail.family}"
  type_scale: "${typography.scale}"
  body_line_height: "${typography.bodyDetail.lineHeight}"
  headings:
    h1: "${typography.h1.size} ${typography.h1.weight} (lh: ${typography.h1.lineHeight}, ls: ${typography.h1.tracking})"
    h2: "${typography.h2.size} ${typography.h2.weight} (lh: ${typography.h2.lineHeight}, ls: ${typography.h2.tracking})"
    h3: "${typography.h3.size} ${typography.h3.weight} (lh: ${typography.h3.lineHeight}, ls: ${typography.h3.tracking})"
    h4: "${typography.h4.size} ${typography.h4.weight} (lh: ${typography.h4.lineHeight})"
tokens:
  button_radius: "${tokens.buttonRadiusLabel}"
  card_radius: "${cardRadius} cards"
  input_radius: "${inputRadius} inputs"
  shadows: "${tokens.shadowSummary}"
  layout_max_width: "${layout.maxWidth}"
  grid_gutter: "${layout.gutter}"
  grid_base: "${gridBase} grid"
  spacing_scale: "${layout.spacingScale}"
motion:
  hover_effects: "${motion.hoverEffects}"
  transition: "${motion.transitionDuration}"
responsive:
  breakpoints: "${responsive.breakpoints}"
  mutations:
${responsiveChangesYaml}
page_structure:
  landmarks: "${structure.landmarks.join(" + ")}"
  flow: "${structure.pageStructure}"
  z_index_layers: "${structure.zIndexLayers}"
---

# Design System Implementation Guidelines (${domain})

This document outlines the design tokens, spatial rhythm, and interaction rules extracted from **${domain}**. 
When implementing user interfaces inspired by this design language:

## 1. Core Visual Directives
- **Anti-Cloning Mandate:** Use these tokens as an abstract mathematical and aesthetic foundation. **Do not** replicate brand trademarks, logos, copy, or copyrighted assets.
- **Theme & Surface:** Base surface is \`${palette.surface}\` (${classification.theme} theme) with \`${palette.elevated}\` for cards and navigation bars.
- **Rhythm & Radius:** Button shape is \`${tokens.buttonRadiusLabel}\` with \`${cardRadius} cards\` and \`${inputRadius} inputs\` form fields.

## 2. Color Palette & WCAG Compliance
| Role | Hex | Luminance Role | Contrast vs Surface | Rating |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (CTA)** | \`${palette.primary}\` | High-impact interactive | ${palette.contrast.primaryOnSurface.formattedRatio} | ${palette.contrast.primaryOnSurface.score} |
| **Accent** | \`${palette.accent}\` | Secondary interactive & badges | - | - |
| **Surface** | \`${palette.surface}\` | Canvas background | Base | Base |
| **Elevated** | \`${palette.elevated}\` | Cards, modals & flyouts | - | - |
| **Text** | \`${palette.text}\` | Primary headings & prose | ${palette.contrast.textOnSurface.formattedRatio} | ${palette.contrast.textOnSurface.score} |
| **Muted** | \`${palette.muted}\` | Secondary labels & captions | ${palette.contrast.mutedOnSurface.formattedRatio} | ${palette.contrast.mutedOnSurface.score} |

## 3. Typography Hierarchy
- **Heading Stack:** \`${typography.h1.family}\`
- **Body Stack:** \`${typography.bodyDetail.family}\`
- **Summary Type Scale:** \`${typography.scale}\`
- **Body Rhythm:** \`${typography.bodyDetail.size}\` with \`${typography.bodyDetail.lineHeight}\` line-height

## 4. Layout & Responsive Geometry
- **Container Max-Width:** \`${layout.maxWidth}\` centered with \`${layout.gutter}\` lateral gutters.
- **Spatial Rhythm:** Base \`${gridBase} grid\` scale: \`${layout.spacingScale}\`.
- **Breakpoints:** \`${responsive.breakpoints}\`.
- **Top-Level Structure:** \`${structure.pageStructure}\`.
`.trim();
}

/**
 * Compiles extracted tokens into modern Tailwind CSS v4 @theme directive.
 */
export function compileTailwindTheme(snap: DesignSystemSnap): string {
  const { domain, palette, typography, tokens, layout } = snap;
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const inputRadius = cleanSuffix(tokens.inputRadius || "18px", "input");
  const buttonRadius = tokens.buttonRadiusLabel?.toLowerCase().includes("pill") ? "9999px" : cardRadius;

  return `/* Extracted from ${domain} with System Prompt Engine (SPE Ω UIDrop) */
@theme {
  --color-primary: ${palette.primary};
  --color-accent: ${palette.accent};
  --color-surface: ${palette.surface};
  --color-elevated: ${palette.elevated};
  --color-text: ${palette.text};
  --color-muted: ${palette.muted};

  --font-heading: "${typography.h1.family}", sans-serif;
  --font-body: "${typography.bodyDetail.family}", sans-serif;

  --radius-card: ${cardRadius};
  --radius-input: ${inputRadius};
  --radius-button: ${buttonRadius};

  --container-max-width: ${layout.maxWidth};
  --container-gutter: ${layout.gutter};
}`.trim();
}

/**
 * Compiles extracted tokens into standard CSS Custom Properties (:root).
 */
export function compileCssVariables(snap: DesignSystemSnap): string {
  const { domain, palette, typography, tokens, layout } = snap;
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const inputRadius = cleanSuffix(tokens.inputRadius || "18px", "input");
  const buttonRadius = tokens.buttonRadiusLabel?.toLowerCase().includes("pill") ? "9999px" : "8px";
  const bodyLineHeight = typography.bodyDetail?.lineHeight || "1.6";

  return `/* Design Tokens Extracted from ${domain} by SPE Ω UIDrop */
:root {
  /* Color Palette */
  --color-primary: ${palette.primary};
  --color-accent: ${palette.accent};
  --color-surface: ${palette.surface};
  --color-elevated: ${palette.elevated};
  --color-text: ${palette.text};
  --color-muted: ${palette.muted};

  /* Typography */
  --font-heading: "${typography.h1.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-body: "${typography.bodyDetail.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-h1: ${typography.h1.size};
  --font-size-h2: ${typography.h2.size};
  --font-size-h3: ${typography.h3.size};
  --font-size-h4: ${typography.h4.size};
  --font-size-body: ${typography.bodyDetail.size};
  --line-height-body: ${bodyLineHeight};

  /* Radii & Elevation */
  --radius-card: ${cardRadius};
  --radius-input: ${inputRadius};
  --radius-button: ${buttonRadius};
  --shadow-elevation: ${tokens.shadowSummary};

  /* Layout */
  --container-max-width: ${layout.maxWidth};
  --container-gutter: ${layout.gutter};
}`.trim();
}

/**
 * Compiles extracted tokens into W3C DTCG / Figma Token Studio JSON format.
 */
export function compileDtcgTokens(snap: DesignSystemSnap): string {
  const { domain, palette, typography, tokens, layout } = snap;
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const inputRadius = cleanSuffix(tokens.inputRadius || "18px", "input");
  const buttonRadius = tokens.buttonRadiusLabel?.toLowerCase().includes("pill") ? "9999px" : cardRadius;

  const dtcg = {
    $schema: "https://design-tokens.github.io/community-group/format/",
    name: `${domain} Design Tokens`,
    description: `Deterministic design tokens extracted by System Prompt Engine (SPE Ω UIDrop) from ${domain}`,
    color: {
      primary: { $type: "color", $value: palette.primary },
      accent: { $type: "color", $value: palette.accent },
      surface: { $type: "color", $value: palette.surface },
      elevated: { $type: "color", $value: palette.elevated },
      text: { $type: "color", $value: palette.text },
      muted: { $type: "color", $value: palette.muted },
    },
    typography: {
      heading: { $type: "fontFamily", $value: typography.h1.family },
      body: { $type: "fontFamily", $value: typography.bodyDetail.family },
    },
    dimension: {
      radiusCard: { $type: "dimension", $value: cardRadius },
      radiusInput: { $type: "dimension", $value: inputRadius },
      radiusButton: { $type: "dimension", $value: buttonRadius },
      containerMaxWidth: { $type: "dimension", $value: layout.maxWidth },
      containerGutter: { $type: "dimension", $value: layout.gutter },
    },
  };

  return JSON.stringify(dtcg, null, 2);
}

/**
 * Compiles a production-ready React + TypeScript component scaffold.
 */
export function compileReactScaffold(snap: DesignSystemSnap): string {
  const { domain, palette, typography, tokens, layout, motion } = snap;
  const cardRadius = cleanSuffix(tokens.cardRadius || "16px", "card");
  const buttonRadius = tokens.buttonRadiusLabel?.toLowerCase().includes("pill") ? "9999px" : "8px";

  return `/**
 * Component Scaffold inspired by ${domain}
 * Generated by System Prompt Engine (SPE Ω UIDrop)
 */
import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  style,
  ...props
}) => {
  const baseStyle: React.CSSProperties = {
    fontFamily: '"${typography.bodyDetail.family}", sans-serif',
    borderRadius: "${buttonRadius}",
    padding: "10px 20px",
    fontWeight: 600,
    fontSize: "${typography.bodyDetail.size}",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "${motion.transitionDuration}",
    ...style,
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "${palette.primary}",
      color: "#FFFFFF",
    },
    secondary: {
      backgroundColor: "${palette.accent}",
      color: "${palette.text}",
    },
    outline: {
      backgroundColor: "transparent",
      borderColor: "${palette.muted}",
      color: "${palette.text}",
    },
  };

  return (
    <button style={{ ...baseStyle, ...variantStyles[variant] }} {...props}>
      {children}
    </button>
  );
};

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  style,
  ...props
}) => (
  <div
    style={{
      backgroundColor: "${palette.elevated}",
      color: "${palette.text}",
      borderRadius: "${cardRadius}",
      padding: "24px",
      boxShadow: "${tokens.shadowSummary}",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      fontFamily: '"${typography.bodyDetail.family}", sans-serif',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const Navbar: React.FC<{ title: string; ctaText?: string }> = ({
  title,
  ctaText = "Get Started",
}) => (
  <header
    style={{
      backgroundColor: "${palette.surface}",
      color: "${palette.text}",
      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      padding: "16px ${layout.gutter}",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: '"${typography.h1.family}", sans-serif',
    }}
  >
    <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{title}</div>
    <Button variant="primary">{ctaText}</Button>
  </header>
);
`.trim();
}

