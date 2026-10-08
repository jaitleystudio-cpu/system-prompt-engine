# C0 FOUNDER_DECISION_REGISTER

**Status of every entry: OPEN.** Nothing here is decided. GILDEN presents options and trade-offs
and does not choose (v3 §33; v2 §22). Options are provider-neutral. Any named
provider/ecosystem is owner-stated or illustrative, not a recommendation.

| ID | Decision | Options (trade-offs in referenced spec) | Blocks | Conflicts |
| --- | --- | --- | --- | --- |
| F01 | Pricing architecture, free-core guarantee wording, price points | A Pro subscription / B perpetual or term licence / C hosted credits (opt-in) / D B2B-first / E services; any combination. Prices `<FOUNDER_DECISION>`. | 01, 02, 10 | C17 |
| F02 | Currency, geography, tax posture, FX source | INR / USD / multi-currency; merchant-of-record vs direct seller (tax consequences UNKNOWN; legal/tax advice) | 01, 10 | — |
| F03 | Payment provider class and provider | Merchant-of-record vs payment gateway; redirect checkout vs embedded. The owner-named landscape includes India-capable gateways and MoR services; their terms are UNKNOWN until fetched. Account opening is founder-only. | 01, 02, 03, 10 | C01, C04, C05, C06, C09 |
| F04 | Entitlement model | L1 offline signed licence / L2 optional account / L3 hybrid | 02, 01 | C10 |
| F05 | Licence signing-key custody | Offline key / HSM / provider-managed (security trade-offs in 02) | 02 | — |
| F06 | Refund and cancellation policy; refund→revocation timing | Immediate revoke / revoke at term end / pro-rata (`<FOUNDER_DECISION>`) | 02, 10 | — |
| F07 | Activate first-party aggregate analytics and attribution; opt-out/GPC; k threshold; campaign-parameter naming | Activate (design 03/04) / defer (house cards run unmeasured) | 03, 04, 07, 08 | C03, C09, C11 |
| F08 | Ad posture | House cards only (default) / plus third-party network (requires CSP/COEP/E3/E7/privacy changes) | 08, 05 | C01, C02, C04, C11 |
| F09 | Sponsor policy: eligible categories, label wording, packages and rates, contract template | Approve spec 05 rules; rates `<FOUNDER_DECISION>` | 05, 07 | C07 |
| F10 | Affiliate programs to apply to; disclosure wording; `sub_id` use | Per-program decision (owner-stated ecosystems are unverified) | 06, 04 | C08 |
| F11 | Which measured metrics may be published; voluntary audience survey | Publish none / aggregate traffic only / plus survey | 07, 05 | C18 |
| F12 | CRM storage, retention, lawful basis | Encrypted local file / private repo / SaaS (cost) | 09 | C16, C12 |
| F13 | Ledger storage; tax and business reserve rules; month-close owner; payout authority | Local or private store / accounting software; reserves `<FOUNDER_DECISION>` | 10 | C16, C12 |
| F14 | Hosting and deploy; confirmation and fate of the Vercel deployment (BUILDER_OBSERVED); DNS; Search Console | Cloudflare Pages (R8 plan) / Vercel / other; must apply E1-equivalent headers | 02, 03, 05–08 (live surfaces) | C14, C15, C19 |
| F15 | Legal texts: privacy policy, terms, refund, disclosure legal review, contract templates | Founder or legal counsel | 01, 05, 06, 09 | C11 |
| F16 | Budget ceilings (v3 §34): monthly, daily, channel, campaign, per-action, approval threshold | `<FOUNDER_DECISION>`; until set, all spend effects STOP | Any spend | C12 |
| F17 | Scoped outreach and email send authority (v3 §36) | None (draft-only, current) / scoped by channel, volume and recipient class | 05, 07, 09 | — |
| F18 | Zero-cost law amendment scope | Keep ₹0 (limits options to A/B/E with minimal infrastructure) / scoped exceptions for revenue operations | 01–03, 09, 10 | C12 |
| F19 | Hosted processing offers (explicit opt-in) | None / opt-in hosted evaluation or compute, separate from local tools | 01 (Option C) | C13 |
| F20 | Services revenue line (paid 3D builds, enterprise pilots) in scope | Yes / no; scope and pricing `<FOUNDER_DECISION>` | 01 (Option E), 09, 10 | — |

## Suggested decision order (dependency-driven, not a recommendation of outcomes)

1. F14 (hosting) and F18 (zero-cost scope), because most server-side capabilities wait on them.
2. F01, F04, F08, F07: product-shape decisions.
3. F03, F02, F15: provider, tax and legal decisions, after shape.
4. F09, F10, F11, F17: channel operations.
5. F12, F13, F16, F05, F06, F19, F20: operations and controls.
