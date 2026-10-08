# 08: PUBLIC_AD_BOUNDARIES_AND_HOUSE_CARD_SPEC (proposal)

Directive: v3 §7 (ads only on appropriate public surfaces; never send private content), §29 (Oct
8–12 "public advertising boundaries"; Oct 23–25 "house-ad fallback"); v2 §10 (HOUSE_CARD_FALLBACK;
private workspace ad-free; no deceptive placement), §31.

## PURPOSE

Fix where any commercial card may appear. Define **first-party house cards** that work under the
current CSP with no change, and state exactly what a third-party ad network would require.

## CURRENT STATE

- Ad slots and house cards: NOT_PRESENT (E20).
- CSP (E1, E2) blocks third-party scripts (`script-src 'self'`), remote images
  (`img-src 'self' data: blob:`), beacons (`connect-src 'self'`) and cross-origin iframes
  (`default-src 'self'`, COEP `require-corp`).
- Ad SDKs are banned (E3, E7).
- The privacy copy promises no ads or ad tracking (E6).
- Private surfaces are marked `NOINDEX_VIEWS` (E10).

## PROPOSED MODEL

**Surface boundary.**

| Surface | Commercial cards allowed? |
| --- | --- |
| `/`, `/capabilities`, `/daily-lab`, future public docs, benchmark and guide pages | Yes, in designated slots |
| `/privacy` | No (trust surface) |
| `/create`, `/code` (tool input/output area) | No inside the tool. An optional slot below the tool is `<FOUNDER_DECISION>`. |
| `/workspace`, `/my-work`, `/website`, `/studio`, `/media`, `/ocr`, `/research` (E10 private) | **Never** (v2 §10: private workspace ad-free) |
| Exports, `.spe` files, generated prompts and sites | **Never** |

**House card.**

- A first-party component: self-hosted image or SVG (`img-src 'self'`), text, and an internal or
  external link.
- No script, no iframe, no remote fetch.
- Content types:
  - SPE Pro, Team and Enterprise (once real);
  - integrations;
  - other SPE tools (cross-tool next action, v3 §20);
  - sponsor creatives in house-card format (spec 05);
  - affiliate cards with disclosure (spec 06).
- Rotation is deterministic: per build or per day. There is no per-user targeting.
- Max cards per page: `<FOUNDER_DECISION>`. A UX guardrail is required (v2 §31).

**UX rules (v2 §10).**

- Never obstruct the tool.
- No fake download buttons.
- Nothing disguised as SPE actions.
- Clear labels: "From SPE", "Sponsor", "Affiliate".
- The impact on accessibility and CWV is measured before launch.

**Third-party ad networks.** This is **not proposed by default**. Enabling one (for example the
owner-cited AdSense) would require ALL of the following explicit founder decisions (F08). The list
is **not** exhaustive; network technical requirements are UNKNOWN until fetched.

1. CSP change: add the network origins to `script-src`, `img-src`, `connect-src` and
   `frame-src`, which weakens E1 (C01–C04).
2. COEP `require-corp` relaxation or a credentialless mode (C04).
3. An E3 and E7 amendment.
4. Rewriting the privacy copy (E6, E11) and the privacy policy (F15).
5. Consent handling where required (UNKNOWN by jurisdiction).
6. A live owned domain with real content (F14).

## DATA MODEL

```text
Slot      { slot_id, surface, position, allowed_types[HOUSE|SPONSOR|AFFILIATE], max_per_page }
HouseCard { card_id, type, title, body, asset_path (self-hosted), link, label, status, approved_copy_ref (E12) }
Rotation  { slot_id, period: BUILD|DAY, card_ids[] }
```

## AUTHORITY BOUNDARY

- Slot placement, card copy and the ad posture are founder-approved (F08).
- GILDEN may propose cards and analyse aggregate performance.

## PRIVACY BOUNDARY

- No targeting.
- Impressions and clicks are counted as aggregates (spec 03) only if F07 approves. Otherwise cards
  run unmeasured.

## SECURITY BOUNDARY

- House cards add zero new origins. The CSP stays byte-identical.
- Links get `rel="noopener"` (plus `sponsored` where applicable).

## ZERO-COST IMPACT

None for house cards. A third-party network would conflict with E3, E6 and E7.

## FOUNDER DECISIONS REQUIRED

F08 (ad posture: house-only by default vs network), F07, F09, F10, F15.

## IMPLEMENTATION DEPENDENCIES

- The copy inventory (E12).
- Specs 05 and 06 for sponsor and affiliate card types.
- Spec 03 for measurement.
- A public surface (F14).

## QUALIFICATION PLAN

1. CSP diff is empty after house-card implementation.
2. No card renders on any E10 private view or export.
3. No external request on render.
4. Labels present.
5. Lighthouse/a11y before/after comparison, with results recorded and none assumed.

## ROLLBACK / DISABLE PATH

A global cards-off flag. Slots collapse with no layout shift.

## UNKNOWN / HOLD

- Network eligibility, RPM and fill: UNKNOWN.
- Third-party ads: HOLD pending F08.

## ACCEPTANCE CRITERIA

- [ ] Surface boundary table accepted.
- [ ] House card accepted as the default monetization surface.
- [ ] Third-party network prerequisites acknowledged.
- [ ] CSP unchanged.
