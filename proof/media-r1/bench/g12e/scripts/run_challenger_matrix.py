#!/usr/bin/env python3
"""G12-E multilingual model challenger matrix — same runtime/fixtures, vary model only."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
import unicodedata
from pathlib import Path

ROOT = Path("/Volumes/4TB-WD/spe-worktrees/spe-g12e-alt-model-trial-20261001/proof/media-r1")
CLI = ROOT / "whisper-cli"
MODELS = ROOT / "models"
HUMAN = ROOT / "fixtures" / "human"
CTRL = ROOT / "fixtures" / "controlled"
OUT = ROOT / "bench" / "g12e"
HYPS = OUT / "hyps"
LOGS = OUT / "logs"
METRICS = OUT / "metrics"
SOURCE_PIN = "927cfce34f31707e17f2bff35c349632fb9e2c3a"
BINARY_SHA256 = "784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7"

# Fixed decode (match G12-D)
DECODE = dict(temperature=0.0, beam_size=5, best_of=5, threads=4, processors=1, flash_attn=True)

def read_text(p: Path | None) -> str | None:
    if p is None or not p.exists():
        return None
    return p.read_text(encoding="utf-8").strip()

def wav_duration_sec(wav: Path) -> float:
    # PCM16 mono 16k: (size - 44) / (16000*2) approx; prefer afinfo
    try:
        r = subprocess.run(["afinfo", str(wav)], capture_output=True, text=True, check=False)
        m = re.search(r"estimated duration:\s*([0-9.]+)\s*sec", r.stdout)
        if m:
            return float(m.group(1))
        m = re.search(r"duration:\s*([0-9.]+)", r.stdout, re.I)
        if m:
            return float(m.group(1))
    except Exception:
        pass
    # fallback WAV header
    sz = wav.stat().st_size
    return max(0.01, (sz - 44) / 32000.0)

def script_counts(text: str) -> dict:
    counts = {"Latin": 0, "Devanagari": 0, "Telugu": 0, "Tamil": 0, "Other": 0}
    for ch in text:
        if ch.isspace() or unicodedata.category(ch).startswith("P") or ch.isdigit():
            continue
        name = unicodedata.name(ch, "")
        if "TELUGU" in name:
            counts["Telugu"] += 1
        elif "DEVANAGARI" in name:
            counts["Devanagari"] += 1
        elif "TAMIL" in name:
            counts["Tamil"] += 1
        elif "LATIN" in name or ("LETTER" in name and ord(ch) < 0x0250):
            counts["Latin"] += 1
        elif ch.isalpha():
            # basic latin fallback
            if ord(ch) < 128:
                counts["Latin"] += 1
            else:
                counts["Other"] += 1
        else:
            counts["Other"] += 1
    return counts

def dominant_script(counts: dict) -> str:
    letters = {k: v for k, v in counts.items() if k != "Other"}
    if not any(letters.values()):
        return "None"
    return max(letters, key=letters.get)

def normalize_for_wer(s: str) -> list[str]:
    s = unicodedata.normalize("NFC", s)
    s = s.replace("।", " ").replace(".", " ").replace(",", " ").replace("?", " ").replace("!", " ")
    s = s.replace(";", " ").replace(":", " ").replace('"', " ").replace("'", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    # keep CJK/Indic as space-separated tokens by whitespace only
    return s.split() if s else []

def levenshtein(a: list[str], b: list[str]) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins, delete, sub = cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]

def wer(ref: str, hyp: str) -> float | None:
    r, h = normalize_for_wer(ref), normalize_for_wer(hyp)
    if not r:
        return None
    return levenshtein(r, h) / len(r)

def cer(ref: str, hyp: str) -> float | None:
    r = list(unicodedata.normalize("NFC", re.sub(r"\s+", "", ref)))
    h = list(unicodedata.normalize("NFC", re.sub(r"\s+", "", hyp)))
    if not r:
        return None
    return levenshtein(r, h) / len(r)

def extract_hyp(stdout: str, timestamps: bool) -> str:
    lines = []
    for line in stdout.splitlines():
        if timestamps:
            m = re.match(r"^\[[0-9:\.]+ --> [0-9:\.]+\]\s*(.*)$", line)
            if m:
                lines.append(m.group(1).strip())
        else:
            # whisper with -nt prints bare text lines after headers; skip ggml/whisper logs
            if re.match(r"^\[[0-9:\.]+ -->", line):
                lines.append(re.sub(r"^\[[0-9:\.]+ --> [0-9:\.]+\]\s*", "", line).strip())
            elif line.strip() and not line.startswith("whisper_") and "ggml_" not in line \
                    and not line.startswith("system_info") and not line.startswith("main:") \
                    and not line.startswith("error:") and "metal" not in line.lower() \
                    and not line.startswith("log_") and "loading" not in line.lower() \
                    and not re.match(r"^\s*whisper_", line):
                # After "output_txt:" style — for -nt, final hyp often last non-log block
                pass
    if lines:
        return " ".join(x for x in lines if x).strip()
    # Fallback: collect lines that look like transcript (have letters)
    candidates = []
    for line in stdout.splitlines():
        s = line.strip()
        if not s:
            continue
        if any(s.startswith(p) for p in ("whisper_", "ggml_", "main:", "system_info", "log_", "error:", "warning:")):
            continue
        if "metal" in s.lower() or "gpu" in s.lower() and "device" in s.lower():
            continue
        if re.search(r"[A-Za-z\u0C00-\u0C7F\u0900-\u097F\u0B80-\u0BFF]", s):
            # skip progress-like
            if re.match(r"^\[", s) and "-->" in s:
                candidates.append(re.sub(r"^\[[^\]]+\]\s*", "", s))
            elif not re.match(r"^[\[\(]", s):
                candidates.append(s)
    return " ".join(candidates).strip()

def extract_lang_detect(stderr_and_out: str) -> tuple[str | None, float | None]:
    # auto-detect: language = xx (p = 0.xxx)
    m = re.search(r"auto-detect:\s*language\s*=\s*([a-z]{2})\s*\(p\s*=\s*([0-9.]+)\)", stderr_and_out, re.I)
    if m:
        return m.group(1), float(m.group(2))
    m = re.search(r"detected language:\s*([a-z]{2})\s*\(p\s*=\s*([0-9.]+)\)", stderr_and_out, re.I)
    if m:
        return m.group(1), float(m.group(2))
    return None, None

def extract_timings(text: str) -> dict:
    out = {}
    m = re.search(r"total time\s*=\s*([0-9.]+)\s*ms", text)
    if m:
        out["total_ms"] = float(m.group(1))
    m = re.search(r"load time\s*=\s*([0-9.]+)\s*ms", text)
    if m:
        out["load_ms"] = float(m.group(1))
    m = re.search(r"encode time\s*=\s*([0-9.]+)\s*ms", text)
    if m:
        out["encode_ms"] = float(m.group(1))
    m = re.search(r"decode time\s*=\s*([0-9.]+)\s*ms", text)
    if m:
        out["decode_ms"] = float(m.group(1))
    return out

def run_one(model_path: Path, wav: Path, lang: str, tag: str, timestamps: bool = True) -> dict:
    HYPS.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    safe = f"{tag}__{model_path.stem}__{lang}__{'ts' if timestamps else 'nt'}"
    log_path = LOGS / f"{safe}.log"
    hyp_path = HYPS / f"{safe}.txt"

    cmd = [
        "/usr/bin/time", "-l",
        str(CLI),
        "-m", str(model_path),
        "-f", str(wav),
        "-l", lang,
        "-t", str(DECODE["threads"]),
        "-p", str(DECODE["processors"]),
        "-bs", str(DECODE["beam_size"]),
        "-bo", str(DECODE["best_of"]),
        "-tp", f"{DECODE['temperature']:.2f}",
        "-fa",
        "-otxt",
        "-of", str(HYPS / safe),
    ]
    if not timestamps:
        cmd.append("-nt")

    t0 = time.perf_counter()
    proc = subprocess.run(cmd, capture_output=True)
    wall = time.perf_counter() - t0
    stdout = (proc.stdout or b"").decode("utf-8", errors="replace")
    stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
    combined = stdout + "\n" + stderr
    log_path.write_text(combined, encoding="utf-8")

    # Prefer whisper -otxt output file
    txt_file = HYPS / f"{safe}.txt"
    hyp = ""
    if txt_file.exists():
        hyp = txt_file.read_text(encoding="utf-8", errors="replace").strip()
        # strip timestamps if present in file
        cleaned = []
        for line in hyp.splitlines():
            m = re.match(r"^\[[0-9:\.]+ --> [0-9:\.]+\]\s*(.*)$", line)
            cleaned.append(m.group(1).strip() if m else line.strip())
        hyp = " ".join(x for x in cleaned if x).strip()
    if not hyp:
        hyp = extract_hyp(combined, timestamps=True)

    det_lang, det_p = extract_lang_detect(combined)
    timings = extract_timings(combined)

    # peak RSS from time -l (macOS): "maximum resident set size" in bytes
    peak_rss = None
    m = re.search(r"^\s*(\d+)\s+maximum resident set size\b", combined, re.M | re.I)
    if m:
        peak_rss = int(m.group(1))
    if peak_rss is None:
        m = re.search(r"^\s*(\d+)\s+peak memory footprint\b", combined, re.M | re.I)
        if m:
            peak_rss = int(m.group(1))

    dur = wav_duration_sec(wav)
    total_ms = timings.get("total_ms", wall * 1000)
    rtf = (total_ms / 1000.0) / dur if dur > 0 else None

    counts = script_counts(hyp)
    dom = dominant_script(counts)

    return {
        "tag": tag,
        "model": model_path.name,
        "model_path": str(model_path),
        "lang_setting": lang,
        "timestamps": timestamps,
        "wav": str(wav),
        "exit_code": proc.returncode,
        "hyp": hyp,
        "script_counts": counts,
        "script_emitted": dom,
        "auto_detect_lang": det_lang,
        "auto_detect_p": det_p,
        "wall_sec": wall,
        "timings_ms": timings,
        "audio_duration_sec": dur,
        "rtf": rtf,
        "peak_rss_bytes": peak_rss,
        "log": str(log_path),
        "hyp_path": str(hyp_path),
        "decode_params": {**DECODE, "SOURCE_PIN": SOURCE_PIN, "BINARY_SHA256": BINARY_SHA256},
    }

FIXTURES = [
    # Primary human TE/ES/HI
    dict(tag="te_human_namaskaramu", lang="te", wav=HUMAN/"te_namaskaramu_16k.wav",
         ref=HUMAN/"te_namaskaramu.ref.txt", source="HUMAN", intended_script="Telugu"),
    dict(tag="te_human_amma", lang="te", wav=HUMAN/"te_amma_16k.wav",
         ref=HUMAN/"te_amma.ref.txt", source="HUMAN", intended_script="Telugu"),
    dict(tag="te_human_dengue_30s", lang="te", wav=HUMAN/"te_dengue_intro_30s.wav",
         ref=None, source="HUMAN", intended_script="Telugu"),
    dict(tag="es_human_contaminacion_30s", lang="es", wav=HUMAN/"es_contaminacion_30s.wav",
         ref=HUMAN/"es_contaminacion_30s.ref.txt", source="HUMAN", intended_script="Latin"),
    dict(tag="hi_human_dengue_30s", lang="hi", wav=HUMAN/"hi_dengue_intro_30s.wav",
         ref=None, source="HUMAN", intended_script="Devanagari"),
    # Preserve EN + TA
    dict(tag="en_human_jfk", lang="en", wav=HUMAN/"en_jfk_human.wav",
         ref=HUMAN/"en_jfk_human.ref.txt", source="HUMAN", intended_script="Latin"),
    dict(tag="ta_tts_short", lang="ta", wav=CTRL/"ta_pcm16.wav",
         ref=CTRL/"ta_pcm16.ref.txt", source="TTS", intended_script="Tamil"),
    # Controlled TE/ES/HI (not for product cert)
    dict(tag="te_tts_short", lang="te", wav=CTRL/"te_pcm16.wav",
         ref=CTRL/"te_pcm16.ref.txt", source="TTS", intended_script="Telugu"),
    dict(tag="es_tts_short", lang="es", wav=CTRL/"es_pcm16.wav",
         ref=CTRL/"es_pcm16.ref.txt", source="TTS", intended_script="Latin"),
    dict(tag="hi_tts_short", lang="hi", wav=CTRL/"hi_pcm16.wav",
         ref=CTRL/"hi_pcm16.ref.txt", source="TTS", intended_script="Devanagari"),
    dict(tag="en_tts_short", lang="en", wav=CTRL/"en_pcm16.wav",
         ref=CTRL/"en_pcm16.ref.txt", source="TTS", intended_script="Latin"),
]

def model_sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def already_done(results, model_name, tag, lang):
    for r in results:
        if r.get("model")==model_name and r.get("tag")==tag and r.get("lang_setting")==lang:
            return True
    return False

def main():
    models = []
    for name in ("ggml-small.bin", "ggml-medium.bin", "ggml-medium-q5_0.bin"):
        p = MODELS / name
        if p.exists() and p.stat().st_size > 1_000_000:
            models.append(p)
        else:
            print(f"SKIP missing/incomplete model: {p}")

    if not models:
        raise SystemExit("No models available")

    model_meta = []
    for p in models:
        # resolve symlink for size/sha of target
        real = p.resolve()
        sha = model_sha(real)
        model_meta.append({
            "MODEL_NAME": p.name,
            "path": str(p),
            "real_path": str(real),
            "MODEL_BYTES": real.stat().st_size,
            "SHA256": sha,
            "SOURCE_COMMIT": "5359861c739e955e79d9a303bcbc70fb988958b1",
            "LICENSE": "MIT (OpenAI Whisper via ggerganov/whisper.cpp ggml)",
            "EXPECTED_MEMORY_CLASS": {
                "ggml-small.bin": "~0.5–1.5GB RSS class",
                "ggml-medium.bin": "~1.5–3.5GB RSS class (8GB RAM tight)",
                "ggml-medium-q5_0.bin": "~0.8–2.0GB RSS class",
            }.get(p.name, "unknown"),
            "role": "BASELINE" if p.name == "ggml-small.bin" else "CHALLENGER",
        })
    (METRICS / "MODELS.json").write_text(json.dumps(model_meta, indent=2) + "\n", encoding="utf-8")

    results = []
    cases_path = METRICS / "G12_E_CASES.json"
    if cases_path.exists():
        try:
            results = json.loads(cases_path.read_text(encoding="utf-8"))
            print(f"RESUME existing_cases={len(results)}")
        except Exception as e:
            print("RESUME_LOAD_FAIL", e)
            results = []
    for model in models:
        for fx in FIXTURES:
            wav = fx["wav"]
            if not wav.exists():
                print(f"MISSING FIXTURE {wav}")
                continue
            ref = read_text(fx["ref"])
            for lang_mode in ("auto", fx["lang"]):
                # For multi-segment human, use timestamps (G12-D lesson)
                use_ts = fx["tag"] in (
                    "te_human_dengue_30s", "es_human_contaminacion_30s", "hi_human_dengue_30s"
                ) or True  # always timestamps for fair multi-seg; short still fine
                if already_done(results, model.name, fx["tag"], lang_mode):
                    print(f"SKIP {model.name} {fx['tag']} lang={lang_mode}", flush=True)
                    continue
                print(f"RUN {model.name} {fx['tag']} lang={lang_mode} ...", flush=True)
                rec = run_one(model, wav, lang_mode, fx["tag"], timestamps=use_ts)
                rec["source_type"] = fx["source"]
                rec["intended_lang"] = fx["lang"]
                rec["intended_script"] = fx["intended_script"]
                rec["reference"] = ref
                rec["human_fixture"] = fx["source"] == "HUMAN"
                if ref is not None:
                    rec["wer"] = wer(ref, rec["hyp"])
                    rec["cer"] = cer(ref, rec["hyp"])
                else:
                    rec["wer"] = None
                    rec["cer"] = None
                    rec["wer_note"] = "NO_VERIFIED_FULL_REF"
                # Telugu script gates
                if fx["lang"] == "te":
                    rec["TELUGU_SCRIPT_OUTPUT"] = rec["script_emitted"]
                    rec["TELUGU_SCRIPT_CORRECT"] = rec["script_emitted"] == "Telugu"
                results.append(rec)
                # checkpoint
                (METRICS / "G12_E_CASES.json").write_text(
                    json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
                )

    print(f"DONE cases={len(results)}")

if __name__ == "__main__":
    main()
