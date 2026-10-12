"""P4: real long-document generation with a FREE local Ollama model (no paid API).
SPE condition  : longdoc.LongDocJob + OllamaGenerator (hierarchical outline, per-section retrieval from the
                 source corpus, glossary memory, previous-section tail, claim manifest).
Baseline       : same model/options, single-pass naive continuation (corpus excerpt up front, then
                 'continue' with the last ~1200 words as context) until the same word target.
Usage: python3 -m spe_runtime.research.agi_brain.p4_ollama {spe|baseline} OUT_DIR TARGET_WORDS"""
from __future__ import annotations
import hashlib, json, math, os, re, sys, time, urllib.request
from collections import Counter
from typing import Dict, List
from .longdoc import LongDocJob, JobConfig, words, _atomic_write

HOST = os.environ.get("SPE_OLLAMA", "http://127.0.0.1:11435")
MODEL = os.environ.get("SPE_P4_MODEL", "qwen2.5:1.5b")
OPTS = {"temperature": 0.7, "top_p": 0.9, "seed": 20261012, "num_ctx": 4096, "repeat_penalty": 1.1}
CORPUS_FILES = ["docs/lvt3/CONTRACT.md", "docs/lvt3/PRIOR_ART.md", "docs/lvt3/RESULTS.md", "docs/agi-brain/ARCHITECTURE.md",
                "docs/agi-brain/CONTRACT_R1.md", "docs/agi-brain/RESULTS_R1.md",
                "docs/plans/2026-10-09-csc-counterfactual-specification-closure-plan.md",
                "docs/plans/2026-10-10-wdic-vct-verified-continuation-transactions-plan.md", "docs/ZERO_COST_PRODUCT_LAW.md"]
INSTRUCTION = ("Write a comprehensive, factual handbook titled 'Verified Research in the System Prompt Engine (SPE)': "
               "explain the LVT-3 experiment, the AGI-BRAIN R1 study, CSC, WDIC-VCT, the zero-cost product law, "
               "the cited prior art, the statistics used, the results and their limitations. Use only facts from the sources.")
TOK = re.compile(r"[A-Za-z][A-Za-z0-9\-]+|\d+(?:\.\d+)?")
STOP = set("the a an and or of to in on for with is are was were be by as at that this it from not no its their which".split())


def ollama(prompt: str, num_predict: int, seed_off: int = 0) -> Dict:
    body = json.dumps({"model": MODEL, "prompt": prompt, "stream": False,
                       "options": dict(OPTS, num_predict=num_predict, seed=OPTS["seed"] + seed_off)}).encode()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(HOST + "/api/generate", body), timeout=900) as r:
                return json.load(r)
        except Exception:
            if attempt == 2: raise
            time.sleep(5)


def model_info() -> Dict:
    with urllib.request.urlopen(HOST + "/api/tags", timeout=30) as r:
        for m in json.load(r)["models"]:
            if m["name"] == MODEL: return {"name": m["name"], "digest": m["digest"], "details": m["details"]}
    raise RuntimeError("model not present")


def load_corpus(root: str) -> List[Dict]:
    chunks = []
    for f in CORPUS_FILES:
        ws = open(os.path.join(root, f), encoding="utf-8").read().split()
        for i in range(0, len(ws), 150):
            chunks.append({"id": f"{os.path.basename(f)}#{i // 150}", "text": " ".join(ws[i:i + 200])})
    return chunks


def _terms(t): return [w.lower() for w in TOK.findall(t) if w.lower() not in STOP]


class BM25:
    def __init__(self, chunks):
        self.c = chunks; self.docs = [Counter(_terms(x["text"])) for x in chunks]
        self.N = len(chunks); self.avg = sum(sum(d.values()) for d in self.docs) / self.N
        df = Counter(t for d in self.docs for t in d); self.idf = {t: math.log(1 + (self.N - n + .5) / (n + .5)) for t, n in df.items()}

    def top(self, q, k=3):
        qt = _terms(q); sc = []
        for i, d in enumerate(self.docs):
            L = sum(d.values()); s = 0.0
            for t in qt:
                if t in d: s += self.idf[t] * d[t] * 2.2 / (d[t] + 1.2 * (0.25 + 0.75 * L / self.avg))
            sc.append((s, i))
        return [self.c[i] for s, i in sorted(sc, reverse=True)[:k]]


def glossary(chunks) -> str:
    """Consistency memory: acronyms seen in the corpus with their first expansion, e.g. 'Foo Bar (FB)'."""
    g = {}
    for c in chunks:
        for m in re.finditer(r"((?:[A-Z][a-z]+[ -]){1,5})\(([A-Z][A-Z0-9-]{1,8})\)", c["text"]):
            if len(m.group(1).split()) >= 2: g.setdefault(m.group(2), m.group(1).strip())
    return "; ".join(f"{k} = {v}" for k, v in sorted(g.items())[:40])


class OllamaGenerator:
    name = f"ollama:{MODEL}"

    def __init__(self, chunks, n_chapters=16, per_chapter=10, log=None):
        self.bm = BM25(chunks); self.gl = glossary(chunks); self.nc, self.pc = n_chapters, per_chapter
        self.log = log; self.tail = ""; self.calls = 0

    def _gen(self, prompt, n, off=0):
        r = ollama(prompt, n, off + self.calls); self.calls += 1
        if self.log: self.log({"eval_count": r.get("eval_count"), "eval_ns": r.get("eval_duration"), "prompt_tokens": r.get("prompt_eval_count")})
        return r["response"]

    def _titles(self, prompt, n, off):
        for a in range(3):
            lines = [re.sub(r"^\s*(\d+[.)]|[-*])\s*", "", l).strip(" *#\"") for l in self._gen(prompt, 400, off + 97 * a).splitlines()]
            lines = [l for l in lines if 3 <= len(l) <= 90]
            uniq = list(dict.fromkeys(lines))
            if len(uniq) >= n: return uniq[:n], False
        return (uniq + [f"Topic {i + 1}" for i in range(n)])[:n], True

    def outline(self, instruction, n_sections):
        assert n_sections == self.nc * self.pc
        ctx = "\n".join(c["text"][:300] for c in self.bm.top(instruction, 4))
        chaps, fb = self._titles(f"Sources:\n{ctx}\n\nTask: {instruction}\nList exactly {self.nc} chapter titles for this handbook, one per line, no extra text.", self.nc, 1)
        self.fallbacks = int(fb); out = []
        for ci, ch in enumerate(chaps):
            sec, fb = self._titles(f"Handbook: {instruction}\nChapter: {ch}\nList exactly {self.pc} distinct section titles for this chapter, one per line, no extra text.", self.pc, 100 + ci)
            self.fallbacks += int(fb)
            out += [f"{ci + 1}.{si + 1} {ch} — {s}" for si, s in enumerate(sec)]
        return out

    def write_section(self, instruction, title, target_words, context):
        src = self.bm.top(title, 3); srcs = "\n\n".join(f"[{c['id']}] {c['text']}" for c in src)
        base = (f"You are writing one section of the handbook '{instruction[:120]}'.\nSOURCES (use only these facts; do not invent numbers or citations):\n{srcs}\n\n"
                f"GLOSSARY (keep these expansions consistent): {self.gl}\n\nEnd of previous section: ...{self.tail}\n\n"
                f"Write the section titled '{title}' in about {target_words} words of plain prose. Do not repeat the title.\n")
        text = self._gen(base, int(target_words * 1.7))
        for k in range(3):
            if words(text) >= 0.9 * target_words: break
            text += " " + self._gen(base + "\nSection so far:\n" + " ".join(text.split()[-300:]) + "\n\nContinue the section without repeating:", int((target_words - words(text)) * 1.7) + 50, 7 + k)
        ws = text.split()
        if len(ws) > target_words * 1.1:  # trim at a sentence end near the target
            cut = " ".join(ws[:int(target_words * 1.1)]); m = cut.rfind(". ")
            text = cut[:m + 1] if m > len(cut) * 0.7 else cut
        self.tail = " ".join(text.split()[-80:])
        claims = []
        for s in re.split(r"(?<=[.!?])\s+", text):
            nums = re.findall(r"\d+(?:\.\d+)?", s)
            if not nums: continue
            ok = [c for c in src if all(n in c["text"] for n in nums)]
            claims.append({"text": s[:300], "status": "verified" if ok else "proposed", "evidence": ok[0]["id"] if ok else None})
        return {"text": text, "claims": claims}


def run_spe(root, out, target, n_ch=16, per=10):
    chunks = load_corpus(root); stats = []
    gen = OllamaGenerator(chunks, n_ch, per, log=stats.append)
    job = LongDocJob(os.path.join(out, "job"), gen, {c["id"]: "corpus" for c in chunks})
    job.create(JobConfig(INSTRUCTION, target, n_ch * per, total_tolerance=0.05, section_tolerance=0.3, max_section_retries=0))
    t0 = time.time(); st = job.run()
    return {"stage": st["stage"], "checks": st.get("checks"), "wall_sec": round(time.time() - t0, 1), "llm_calls": len(stats),
            "gen_tokens": sum(s["eval_count"] or 0 for s in stats), "outline_fallbacks": getattr(gen, "fallbacks", None)}


def run_baseline(root, out, target):
    chunks = load_corpus(root); excerpt = " ".join(" ".join(c["text"].split()[:150]) for c in chunks)[:9000]
    os.makedirs(out, exist_ok=True); path = os.path.join(out, "baseline.md"); state = os.path.join(out, "baseline_state.json")
    st = json.load(open(state)) if os.path.exists(state) else {"text": "", "calls": 0, "tokens": 0}
    t0 = time.time()
    while words(st["text"]) < target:
        if not st["text"]:
            p = f"SOURCES:\n{excerpt}\n\nTask: {INSTRUCTION}\nBegin the handbook now."
        else:
            p = f"Task: {INSTRUCTION}\n\nText so far (last part):\n{' '.join(st['text'].split()[-1200:])}\n\nContinue the handbook:"
        r = ollama(p, 900, st["calls"]); st["text"] += ("\n\n" if st["text"] else "") + r["response"].strip()
        st["calls"] += 1; st["tokens"] += r.get("eval_count") or 0
        _atomic_write(state, json.dumps(st))
    ws = st["text"].split(); _atomic_write(path, " ".join(ws[:target]) if len(ws) > target else st["text"])
    return {"stage": "exported", "words": min(len(ws), target), "llm_calls": st["calls"], "gen_tokens": st["tokens"], "wall_sec_this_session": round(time.time() - t0, 1)}


if __name__ == "__main__":
    mode, out, target = sys.argv[1], sys.argv[2], int(sys.argv[3]); root = os.getcwd()
    os.makedirs(out, exist_ok=True)
    info = {"model": model_info(), "options": OPTS, "host": HOST, "target_words": target, "mode": mode,
            "corpus_sha256": {f: hashlib.sha256(open(f, "rb").read()).hexdigest() for f in CORPUS_FILES}}
    res = run_spe(root, out, target, int(os.environ.get("SPE_P4_CH", 16)), int(os.environ.get("SPE_P4_PER", 10))) if mode == "spe" else run_baseline(root, out, target)
    info.update(res); json.dump(info, open(os.path.join(out, f"run_{mode}.json"), "w"), indent=1)
    print(json.dumps(info, indent=1))
