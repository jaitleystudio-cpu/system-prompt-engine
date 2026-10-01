# Human speech fixtures (lawful sources)

| File | Source | License | Notes |
| --- | --- | --- | --- |
| en_jfk_human.wav | whisper.cpp samples/jfk.wav | public-domain speech excerpt bundled upstream | EN control |
| es_contaminacion*.wav | https://upload.wikimedia.org/wikipedia/commons/c/c1/La_contaminacion_del_agua.ogg | free Wikimedia (same URL as whisper.cpp tests/es-0) | ES human; 30s truncate for latency |
| hi_dengue_intro*.wav | File:Hindi Dengue Introduction.ogg (Commons) | CC BY-SA 3.0 | Spoken Wikipedia Hindi; Satyam Singh et al. |
| te_namaskaramu*.wav | File:Te-నమస్కారము.oga | Wikimedia Commons | single-word human Telugu |
| te_amma*.wav | File:Te-అమ్మ.oga | Wikimedia Commons | single-word human Telugu |
| te_dengue_intro*.wav | File:Dengue Telugu Intro+Symptoms.ogg | Wikimedia Commons | Telugu spoken medical intro; 30s truncate |

Host ffmpeg used only to resample to 16 kHz mono WAV for whisper-cli. Product path unchanged.
