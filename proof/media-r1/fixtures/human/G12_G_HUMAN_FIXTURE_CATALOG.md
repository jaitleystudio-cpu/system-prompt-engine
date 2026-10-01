# G12-G Telugu human fixture catalog

HUMAN_FIXTURE_GATE=PASS (reuse G12-D lawful Wikimedia Commons TE fixtures)
TTS_SUPPLEMENTARY_ONLY=YES (te_pcm16 controlled; not for product cert)

| Fixture ID | Anonymized speaker ID | Duration | Quality | Dialect (voluntary) | Reference transcript | Provenance | Consent/License |
| --- | --- | --- | --- | --- | --- | --- | --- |
| te_namaskaramu_16k | TE-SPK-COMMONS-01 | ~2.0 s (afinfo) | clean single-word; 16 kHz mono PCM | UNKNOWN (not declared on Commons) | నమస్కారము | Wikimedia Commons File:Te-నమస్కారము.oga → resampled 16 kHz | Wikimedia Commons (free media; see file page); SPE uses for ASR bench only |
| te_amma_16k | TE-SPK-COMMONS-02 | ~2.1 s | clean single-word; 16 kHz mono PCM | UNKNOWN | అమ్మ | Wikimedia Commons File:Te-అమ్మ.oga → resampled 16 kHz | Wikimedia Commons (free media; see file page) |
| te_dengue_intro_30s | TE-SPK-COMMONS-03 | 30.0 s truncate | spoken medical intro; 16 kHz mono | UNKNOWN | NO_VERIFIED_FULL_REF (WER=N/A; qualitative content/script gate only) | Wikimedia Commons File:Dengue Telugu Intro+Symptoms.ogg first 30s | Wikimedia Commons |

IDENTITY_POLICY=no unnecessary identity; Commons usernames not retained beyond source URL in provenance.
MANUAL_REF_VERIFY=YES for short words (te_namaskaramu, te_amma) — refs match filename orthography and audible content.
DENGUE_REF=UNKNOWN_FULL — HOLD WER for this fixture; still usable for script + hallucination/omission qualitative scoring.
