# G12-H Telugu human fixture catalog (independent qualification)

HUMAN_FIXTURES=multiple lawful human TE fixtures with speaker/length/rate/noise/device variation.
TTS_SUPPLEMENTARY_ONLY=YES when present. IDENTITY_POLICY=no unnecessary PII; Commons usernames not retained beyond source URL.

| Fixture ID | Speaker ID | Dur | Variation | Ref | Provenance / License |
| --- | --- | --- | --- | --- | --- |
| te_namaskaramu_16k | TE-SPK-COMMONS-01 | ~2.0s | clean short | నమస్కారము | Commons File:Te-నమస్కారము.oga |
| te_amma_16k | TE-SPK-COMMONS-02 | ~2.1s | clean short | అమ్మ | Commons File:Te-అమ్మ.oga |
| te_kaalu_16k | TE-SPK-COMMONS-04 | ~2.5s | clean short / distinct word | కాలు | Commons File:Te-కాలు.oga |
| te_araka_16k | TE-SPK-COMMONS-05 | ~2.2s | clean short / distinct word | అరక | Commons File:Te-అరక.oga |
| te_kurupam_16k | TE-SPK-COMMONS-06 | ~2.0s | clean short / place name | కురూపం | Commons File:Te-కురూపం.oga |
| te_dengue_intro_30s | TE-SPK-COMMONS-03 | 30s | long spoken medical | NO_VERIFIED_FULL_REF | Commons File:Dengue Telugu Intro+Symptoms.ogg truncate |
| te_dengue_intro_45s | TE-SPK-COMMONS-03 | 45s | longer same speaker | NO_VERIFIED_FULL_REF | same source, 45s slice |
| te_vizag_dengue_pa_20s | TE-SPK-COMMONS-07 | 20s | PA/device outdoor-ish | NO_VERIFIED_FULL_REF | Commons File:Public announcement Vizag on Dengue 05 Jun 19.opus |
| te_amma_light_noise_16k | TE-SPK-COMMONS-02 (derived) | ~2.1s | light additive noise | అమ్మ | derived from te_amma_16k (same license chain) |
| te_namaskaramu_fast_16k | TE-SPK-COMMONS-01 (derived) | ~1.7s | rate +15% atempo | నమస్కారము | derived from te_namaskaramu_16k |

ROBUSTNESS_COVERAGE:
- clean/short: YES (namaskaramu, amma, kaalu, araka, kurupam)
- long: YES (dengue 30s/45s)
- light noise: YES (derived amma)
- rate: YES (derived namaskaramu fast)
- device/PA: YES (vizag announcement)
- numbers: UNKNOWN (no verified numeric TE human fixture with ref)
- names: PARTIAL (kurupam place-name; no personal-name corpus)
- mixed TE-EN: UNKNOWN (no verified mixed fixture with ref)
- dialect: UNKNOWN (Commons does not declare dialect)

MANUAL_REF_VERIFY=YES for short filename-orthography words.
