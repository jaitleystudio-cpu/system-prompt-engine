# C0 DEPENDENCY_GRAPH

Nodes are C0 specs (`S01`–`S10`), founder decisions (`F##`, see register) and external gates. An
edge `A --> B` means B depends on A.

```mermaid
graph TD
  F14[F14 Hosting / deploy / DNS] --> S03[03 Event schema]
  F14 --> S02[02 Entitlement]
  F18[F18 Zero-cost scope] --> S01[01 Pricing]
  F18 --> S03
  F01[F01 Pricing architecture] --> S01
  F04[F04 Entitlement model] --> S02
  F05[F05 Key custody] --> S02
  F03[F03 Payment provider] --> S02
  F03 --> S10[10 Revenue ledger]
  F07[F07 Analytics activation] --> S03
  F07 --> S04[04 Attribution]
  F21[F21 Attribution integrity] --> S04
  F22[F22 Licence binding] --> S02
  F08[F08 Ad posture] --> S08[08 Ad boundaries + house cards]
  F09[F09 Sponsor policy] --> S05[05 Sponsor Center]
  F10[F10 Affiliate programs] --> S06[06 Affiliate disclosure]
  F11[F11 Publishable metrics] --> S07[07 Media kit]
  F12[F12 CRM storage] --> S09[09 CRM]
  F13[F13 Ledger storage + reserves] --> S10
  F15[F15 Legal texts] --> S01
  F15 --> S05
  F15 --> S06
  F17[F17 Send authority] --> S09
  E12[Copy inventory approval] --> S08
  E12 --> S06
  E12 --> S05

  S01 --> S02
  S01 --> S10
  S02 --> S10
  S03 --> S04
  S03 --> S07
  S04 --> S10
  S08 --> S05
  S08 --> S06
  S08 --> S07
  S05 --> S07
  S05 --> S09
  S06 --> S09
  S09 --> S10
  S05 --> S10
  S06 --> S10
```

## Readiness by spec (docs vs implementation)

| Spec | Draftable now (docs) | Implementable only after |
| --- | --- | --- |
| 01 Pricing | ✔ (this PR) | F01, F02, F18, F15 |
| 02 Entitlement | ✔ | F04, F05, F22, F03, F14 |
| 03 Event schema | ✔ | F07, F14, F18 |
| 04 Attribution | ✔ | 03 implemented, F07, F10, F21 (option B also needs F14) |
| 05 Sponsor Center | ✔ | 08, F09, F15, F17, live surface (F14) |
| 06 Affiliate disclosure | ✔ | 08, F10, F15 |
| 07 Media kit | ✔ (template) | 03 measuring, F11 |
| 08 Ad boundaries + house cards | ✔ | F08, copy approval (E12), live surface (F14) |
| 09 CRM | ✔ | F12, F17 |
| 10 Revenue ledger | ✔ | F13, F02, F03 |

**Critical path to any self-serve revenue:** F14 → F18 → F01, F04 → F03 → S02 and S10 qualified →
founder go-live.

**SERVICES path (may operate manually without product infrastructure):** F20 → F15 → F12, F13 →
S09 and S10 (manual evidence) → founder-signed contract. It needs no checkout, entitlement,
collector or public ad surface.

**SPONSOR INVENTORY path (NOT infrastructure-free):** contracting and invoicing may be manual (F09
→ F15 → F12, F13 → S09, S10 manual evidence), but delivering the placement still requires an
approved public surface: F14 (hosting/deploy) → F08 → S08 house-card renderer plus E12 copy
approval → S05 → live placement. A sponsor contract must not be signed for a placement that has no
approved, live surface to deliver it.
