"""Deterministic site CSS. No remote fonts, images, or network URLs."""

from __future__ import annotations

SITE_CSS = """/* website-generator v1 — static, offline, no remote assets */
:root {
  color-scheme: dark;
  --bg: #050608;
  --bg-elevated: #12161e;
  --text: #f2eee6;
  --muted: #d5dbe3;
  --link: #e7f6ff;
  --line: rgba(214, 226, 240, 0.28);
  --focus: #9fd4e4;
  --cta-bg: #f2eee6;
  --cta-text: #141820;
  --space: 1.25rem;
}

html[data-theme="light"] {
  color-scheme: light;
  --bg: #f4f1ea;
  --bg-elevated: #ffffff;
  --text: #141820;
  --muted: #3a4250;
  --link: #0b3a66;
  --line: rgba(20, 24, 32, 0.18);
  --focus: #0b3a66;
  --cta-bg: #141820;
  --cta-text: #f4f1ea;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "Avenir Next", "Segoe UI", system-ui, sans-serif;
  font-size: 1.0625rem;
  line-height: 1.55;
}

.skip-link {
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  transform: translateY(-150%);
  background: var(--cta-bg);
  color: var(--cta-text);
  padding: 0.75rem 1rem;
  z-index: 2;
  text-decoration: none;
}

.skip-link:focus {
  transform: none;
}

.wrap {
  width: min(68rem, calc(100% - 2rem));
  margin-inline: auto;
}

header,
nav,
main,
footer {
  padding-block: var(--space);
}

header {
  border-bottom: 1px solid var(--line);
}

.site-name {
  margin: 0;
  font-size: 1rem;
}

.site-name a {
  color: var(--text);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
}

nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

nav a {
  color: var(--link);
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0.35rem 0.7rem;
  text-underline-offset: 0.2em;
}

nav a[aria-current="page"] {
  text-decoration-thickness: 2px;
  background: var(--bg-elevated);
}

main h1,
main h2 {
  font-family: "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif;
  line-height: 1.15;
  margin: 0 0 0.75rem;
}

main h1 {
  font-size: clamp(2rem, 5vw, 3.25rem);
  max-width: 18ch;
}

main h2 {
  font-size: clamp(1.4rem, 3vw, 2rem);
  margin-top: 2rem;
}

p,
li {
  max-width: 68ch;
}

.muted,
footer p {
  color: var(--muted);
}

.section + .section {
  margin-top: 0.5rem;
}

.cta {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--cta-bg);
  color: var(--cta-text);
  text-decoration: none;
  border-radius: 999px;
}

a:focus-visible,
.cta:focus-visible,
.skip-link:focus-visible {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
"""
