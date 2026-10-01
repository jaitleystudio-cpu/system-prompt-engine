#!/usr/bin/env python3
"""G12-G Telugu-specific human bench: baseline ggml-small.bin vs ggml-te-small.bin."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import time
import unicodedata
from pathlib import Path

ROOT = Path("/Volumes/4TB-WD/spe-worktrees/spe-g12g-te-human-bench-20261001/proof/media-r1")
CLI = ROOT / "whisper-cli"
MODELS = ROOT / "models"
HUMAN = ROOT / "fixtures" / "human"
CTRL = ROOT / "fixtures" / "controlled"
OUT = ROOT / "bench" / "g12g"
HYPS = OUT / "hyps"
LOGS = OUT / "logs"
METRICS = OUT / "metrics"
SOURCE_PIN = "927cfce34f31707e17f2bff35c349632fb9e2c3a"
BINARY_SHA256 = "784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7"

# Identical decode for both models. -nt required for TE fine-tune; applied to BOTH for fairness.
DECODE = dict(temperature=0.0, beam_size=5, best_of=5, threads=4, processors=1, flash_attn=True, no_timestamps=True)

MODELS_SPEC = [
    {
        "role": "BASELINE",
        "name": "ggml-small.bin",
        "path": MODELS / "ggml-small.bin",
        "expected_sha256": "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    },
    {
        "role": "CHALLENGER_TE",
        "name": "ggml-te-small.bin",
        "path": MODELS / "ggml-te-small.bin",
        "expected_sha256": "47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e",
    },
]

FIXTURES = [
    {
        "id": "te_namaskaramu_human",
        "kind": "human",
        "wav": HUMAN / "te_namaskaramu_16k.wav",
        "ref": HUMAN / "te_namaskaramu.ref.txt",
        "lang": "te",
        "speaker": "TE-SPK-COMMONS-01",
    },
    {
        "id": "te_amma_human",
        "kind": "human",
        "wav": HUMAN / "te_amma_16k.wav",
        "ref": HUMAN / "te_amma.ref.txt",
        "lang": "te",
        "speaker": "TE-SPK-COMMONS-02",
    },
    {
        "id": "te_dengue_30s_human",
        "kind": "human",
        "wav": HUMAN / "te_dengue_intro_30s.wav",
        "ref": None,  # no verified full ref
        "lang": "te",
        "speaker": "TE-SPK-COMMONS-03",
    },
    {
        "id": "te_tts_short_controlled",
        "kind": "tts_supplementary",
        "wav": CTRL / "te_pcm16.wav",
        "ref": CTRL / "te_pcm16.ref.txt",
        "lang": "te",
        "speaker": "TTS-SUPPLEMENTARY",
    },
]


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_text(p: Path | None) -> str | None:
    if p is None or not p.exists():
        return None
    return p.read_text(encoding="utf-8").strip()


def wav_duration_sec(wav: Path) -> float:
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
        elif "LATIN" in name or ord(ch) < 0x0250:
            counts["Latin"] += 1
        elif ch.isalpha():
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
    s = unicodedata.normalize("NFC", s or "")
    s = s.replace("\u200c", "").replace("\u200d", "")
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return []
    return s.split(" ")


def normalize_for_cer(s: str) -> str:
    s = unicodedata.normalize("NFC", s or "")
    s = s.replace("\u200c", "").replace("\u200d", "")
    s = re.sub(r"\s+", "", s)
    return s


def levenshtein(a, b) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins = cur[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, delete, sub))
        prev = cur
    return prev[-1]


def wer(ref: str, hyp: str) -> float | None:
    r = normalize_for_wer(ref)
    h = normalize_for_wer(hyp)
    if not r:
        return None
    return levenshtein(r, h) / len(r)


def cer(ref: str, hyp: str) -> float | None:
    r = normalize_for_cer(ref)
    h = normalize_for_cer(hyp)
    if not r:
        return None
    return levenshtein(list(r), list(h)) / len(r)


def extract_hyp(stdout: str) -> str:
    # whisper-cli with -nt prints transcript lines; strip timestamps if any leaked
    lines = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("whisper_") or line.startswith("ggml_") or line.startswith("system_info"):
            continue
        if "loading model" in line.lower() or "processing" in line.lower():
            continue
        # [00:00:00.000 --> 00:00:01.000] text
        m = re.match(r"^\[.*?\]\s*(.*)$", line)
        if m:
            lines.append(m.group(1).strip())
            continue
        # skip progressive / metric lines
        if re.match(r"^(whisper_|ggml_|metal_|load |encode |decode |total time|timings:)", line, re.I):
            continue
        if ":" in line and any(k in line.lower() for k in ("ms", "mb", "rtf", "threads")):
            # likely timing/stat
            if not re.search(r"[\u0C00-\u0C7F]", line):  # no Telugu
                continue
        lines.append(line)
    # Prefer contiguous Telugu-heavy lines; else join all
    text = " ".join(lines).strip()
    # Sometimes CLI prints only the final text after blank; already handled
    return unicodedata.normalize("NFC", text)


def parse_time_l(stderr: str) -> dict:
    out = {}
    # macOS /usr/bin/time -l
    m = re.search(r"^\s*([\d.]+)\s+real", stderr, re.M)
    if m:
        out["wall_sec"] = float(m.group(1))
    m = re.search(r"^\s*(\d+)\s+maximum resident set size", stderr, re.M|re.I)
    if m:
        # bytes on macOS
        out["peak_rss_bytes"] = int(m.group(1))
        out["peak_rss_mb"] = int(m.group(1)) / (1024 * 1024)
    return out


def parse_whisper_timings(stderr: str, stdout: str) -> dict:
    blob = stderr + "\n" + stdout
    out = {}
    m = re.search(r"total time\s*=\s*([0-9.]+)\s*ms", blob, re.I)
    if m:
        out["total_ms"] = float(m.group(1))
    m = re.search(r"load time\s*=\s*([0-9.]+)\s*ms", blob, re.I)
    if m:
        out["load_ms"] = float(m.group(1))
    return out


def hallucination_flags(hyp: str, ref: str | None) -> dict:
    tokens = normalize_for_wer(hyp)
    flags = {
        "empty": len(tokens) == 0,
        "repetition_loop": False,
        "extreme_length_vs_ref": False,
        "bad_hallucination": False,
    }
    if len(tokens) >= 6:
        # consecutive duplicate trigrams
        tri = [" ".join(tokens[i : i + 3]) for i in range(len(tokens) - 2)]
        from collections import Counter
        c = Counter(tri)
        if c and c.most_common(1)[0][1] >= 3:
            flags["repetition_loop"] = True
    if ref:
        r = normalize_for_wer(ref)
        if r and len(tokens) >= max(8, 5 * len(r)):
            flags["extreme_length_vs_ref"] = True
    flags["bad_hallucination"] = flags["repetition_loop"] or flags["extreme_length_vs_ref"]
    return flags


def run_one(model: dict, fixture: dict, lang_mode: str) -> dict:
    HYPS.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    case_id = f"{model['role']}_{fixture['id']}_{lang_mode}"
    hyp_path = HYPS / f"{case_id}.txt"
    out_path = LOGS / f"{case_id}.stdout.txt"
    err_path = LOGS / f"{case_id}.stderr.txt"

    cmd = [
        "/usr/bin/time",
        "-l",
        str(CLI),
        "-m",
        str(model["path"]),
        "-f",
        str(fixture["wav"]),
        "-tp",
        "0",
        "-bs",
        str(DECODE["beam_size"]),
        "-bo",
        str(DECODE["best_of"]),
        "-t",
        str(DECODE["threads"]),
        "-p",
        str(DECODE["processors"]),
        "-fa",
        "-nt",
        "-np",  # no prints progress noise where supported
    ]
    if lang_mode == "explicit":
        cmd.extend(["-l", fixture["lang"]])
    else:
        cmd.extend(["-l", "auto"])

    # Some builds use -np differently; if fails we retry without -np
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0 and "-np" in cmd:
        cmd = [c for c in cmd if c != "-np"]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    wall = time.time() - t0

    out_path.write_text(r.stdout, encoding="utf-8")
    err_path.write_text(r.stderr, encoding="utf-8")

    hyp = extract_hyp(r.stdout)
    # Fallback: last non-empty line of stdout if extract empty but stdout has Telugu
    if not hyp:
        for line in reversed(r.stdout.splitlines()):
            line = line.strip()
            if line and not line.lower().startswith("whisper"):
                hyp = line
                break
    hyp_path.write_text(hyp + "\n", encoding="utf-8")

    ref = read_text(fixture.get("ref"))
    counts = script_counts(hyp)
    dom = dominant_script(counts)
    te_script_ok = dom == "Telugu"
    timings = parse_time_l(r.stderr)
    wtim = parse_whisper_timings(r.stderr, r.stdout)
    dur = wav_duration_sec(fixture["wav"])
    wall_sec = timings.get("wall_sec", wall)
    rtf = wall_sec / dur if dur > 0 else None
    hall = hallucination_flags(hyp, ref)
    w = wer(ref, hyp) if ref is not None else None
    c = cer(ref, hyp) if ref is not None else None

    # Content gate for TE: Telugu script AND (WER materially usable OR qualitative not-hallucinating for no-ref)
    content_pass = None
    if fixture["lang"] == "te":
        if not te_script_ok:
            content_pass = False
        elif ref is not None:
            # usable: WER <= 0.5 on short refs OR exact match
            content_pass = (w is not None and w <= 0.5) and not hall["bad_hallucination"]
        else:
            # dengue: require Telugu script, non-empty, no repetition loop, some length
            content_pass = (
                te_script_ok
                and not hall["empty"]
                and not hall["repetition_loop"]
                and len(normalize_for_wer(hyp)) >= 3
            )

    return {
        "case_id": case_id,
        "model_role": model["role"],
        "model_name": model["name"],
        "fixture_id": fixture["id"],
        "fixture_kind": fixture["kind"],
        "speaker": fixture.get("speaker"),
        "lang_mode": lang_mode,
        "language_flag": fixture["lang"] if lang_mode == "explicit" else "auto",
        "audio_path": str(fixture["wav"]),
        "audio_sha256": sha256_file(fixture["wav"]),
        "duration_sec": dur,
        "exit_code": r.returncode,
        "hypothesis": hyp,
        "reference": ref,
        "wer": w,
        "cer": c,
        "script_counts": counts,
        "dominant_script": dom,
        "TELUGU_SCRIPT_CORRECT": te_script_ok,
        "CONTENT_GATE_PASS": content_pass,
        "hallucination": hall,
        "wall_sec": wall_sec,
        "rtf": rtf,
        "peak_rss_mb": timings.get("peak_rss_mb"),
        "peak_rss_bytes": timings.get("peak_rss_bytes"),
        "load_ms": wtim.get("load_ms"),
        "total_ms": wtim.get("total_ms"),
        "cmd": cmd,
        "decode": DECODE,
        "source_pin": SOURCE_PIN,
        "binary_sha256": BINARY_SHA256,
    }


def main():
    METRICS.mkdir(parents=True, exist_ok=True)
    # verify models
    models_meta = []
    for m in MODELS_SPEC:
        assert m["path"].exists(), m["path"]
        got = sha256_file(m["path"])
        assert got == m["expected_sha256"], (m["name"], got, m["expected_sha256"])
        models_meta.append({**{k: (str(v) if isinstance(v, Path) else v) for k, v in m.items()}, "sha256_verified": got})
    assert CLI.exists()
    cli_sha = sha256_file(CLI)
    assert cli_sha == BINARY_SHA256, (cli_sha, BINARY_SHA256)

    cases = []
    for model in MODELS_SPEC:
        for fixture in FIXTURES:
            for lang_mode in ("explicit", "auto"):
                print(f"RUN {model['role']} {fixture['id']} {lang_mode}", flush=True)
                cases.append(run_one(model, fixture, lang_mode))

    (METRICS / "G12_G_CASES.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (METRICS / "MODELS.json").write_text(json.dumps(models_meta, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE {len(cases)} cases", flush=True)


if __name__ == "__main__":
    main()
