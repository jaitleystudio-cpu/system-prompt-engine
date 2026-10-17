# References consulted (working notes)

## user-Refero
- Attempted: `refero_search_styles` (editorial paper atlas), `refero_search_screens` (progressive disclosure; Simple/Inspect dual panels)
- Result: **BLOCKED** — `NO_SUBSCRIPTION` (https://refero.design/mcp/upgrade). No paid upgrade performed (₹0 / HOSTING FORBIDDEN / no new paid deps).

## user-Mobbin
- Attempted: `search_screens` (Create mobile disclosure), `search_sections` (capability atlas), `search_flows` (compose + advanced settings)
- Result: **BLOCKED** — paid plan required (https://mobbin.com/pricing). No paid upgrade performed.

## user-Ads-mcp (applied)
- `ads_get_a11y_guidelines` topics: forms, keyboard, focus, aria
- `ads_get_guidelines` terms: typography hierarchy, spacing rhythm, elevation paper, content structure
- `ads_analyze_a11y` on disclosure + Simple/Inspect toggle snippet (0 pattern violations; prefer semantic HTML)
- `ads_suggest_a11y_fixes` for disclosure keyboard/expanded-state (prefer native details/summary + button toggles)

### Applied craft rules from ADS
1. Prefer semantic HTML (`details`/`summary`) over custom ARIA accordions.
2. Visible focus indicators; logical tab order; Enter/Space activation.
3. `aria-pressed` for Simple/Inspect presentation switch.
4. Group with whitespace + borders/rules; avoid excessive raised card elevations (anti–SaaS grid).
5. Vertical stack rhythm for mobile scanability; restrained paper/surface hierarchy.
