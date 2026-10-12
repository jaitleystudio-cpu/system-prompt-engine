"""Frozen local retrievers over the frozen corpus + local Ollama (127.0.0.1:11435) for embeddings / query generation."""
from __future__ import annotations
import hashlib, json, math, os, re, time, urllib.request
from collections import Counter, defaultdict
from typing import Dict, List, Tuple

OLLAMA = os.environ.get("RGD1_OLLAMA", "http://127.0.0.1:11435")
GEN_MODEL = "qwen2.5:1.5b"
EMB_MODEL = "nomic-embed-text"
TOK = re.compile(r"[a-z0-9]+")
STOP = set("a an the of and or in on for to with by from at is are was were be as that this these those we our its it into via using".split())


def toks(s: str) -> List[str]:
    return [t for t in TOK.findall(s.lower()) if t not in STOP]


class BM25:
    def __init__(self, docs: List[Dict], k1=1.2, b=0.75):
        self.ids = [d["id"] for d in docs]; self.k1, self.b = k1, b
        self.tf = []; df = Counter(); self.len = []
        for d in docs:
            c = Counter(toks(d["text"])); self.tf.append(c); self.len.append(sum(c.values())); df.update(c.keys())
        n = len(docs); self.avg = sum(self.len) / n
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.post = defaultdict(list)
        for i, c in enumerate(self.tf):
            for t in c: self.post[t].append(i)

    def search(self, q: str, k: int = 10) -> List[Tuple[str, float]]:
        sc = defaultdict(float)
        for t in set(toks(q)):
            if t not in self.idf: continue
            for i in self.post[t]:
                f = self.tf[i][t]
                sc[i] += self.idf[t] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
        top = sorted(sc.items(), key=lambda x: (-x[1], self.ids[x[0]]))[:k]
        return [(self.ids[i], s) for i, s in top]


def _post(path, payload, timeout=120):
    req = urllib.request.Request(OLLAMA + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.loads(r.read())


class EmbedCache:
    def __init__(self, path):
        self.path = path; self.d = {}
        if os.path.exists(path):
            for l in open(path): r = json.loads(l); self.d[r["k"]] = r["v"]
    def get(self, text, prefix):
        t = (prefix + text)[:2000]; k = hashlib.sha256((EMB_MODEL + t).encode()).hexdigest()
        if k not in self.d:
            v = _post("/api/embeddings", {"model": EMB_MODEL, "prompt": t})["embedding"]; self.d[k] = v
            with open(self.path, "a") as fh: fh.write(json.dumps({"k": k, "v": v}) + "\n")
        return self.d[k]


def cos(a, b):
    na = math.sqrt(sum(x * x for x in a)); nb = math.sqrt(sum(x * x for x in b))
    return sum(x * y for x, y in zip(a, b)) / (na * nb + 1e-12)


PROMPT = ("You check whether a published conclusion still stands. Paper title: \"{title}\"\n"
          "Write exactly 3 short literature search queries (one per line, no numbering, no quotes) that would find "
          "evidence that OVERTURNS this paper: (1) a retraction or withdrawal notice for it, (2) a study contradicting it, "
          "(3) a failed replication or expression of concern. Each query must include the paper's key terms.")


def gen_queries(title: str, cache_path: str) -> Tuple[List[str], float]:
    k = hashlib.sha256((GEN_MODEL + PROMPT + title).encode()).hexdigest()
    cache = {}
    if os.path.exists(cache_path):
        for l in open(cache_path): r = json.loads(l); cache[r["k"]] = r
    if k in cache: return cache[k]["q"], cache[k]["lat"]
    t0 = time.time()
    r = _post("/api/generate", {"model": GEN_MODEL, "prompt": PROMPT.format(title=title), "stream": False,
                                "options": {"temperature": 0, "seed": 0, "num_predict": 120}})
    lat = time.time() - t0
    lines = [re.sub(r"^[\s\-\*\d\.\)\(]+", "", l).strip().strip('"') for l in r["response"].splitlines()]
    q = [l for l in lines if len(toks(l)) >= 2][:3] or [title]
    with open(cache_path, "a") as fh: fh.write(json.dumps({"k": k, "q": q, "lat": lat, "raw": r["response"]}) + "\n")
    return q, lat


def rrf(lists: List[List[str]], k: int = 10, c: int = 60) -> List[str]:
    s = defaultdict(float)
    for L in lists:
        for r, d in enumerate(L): s[d] += 1.0 / (c + r + 1)
    return [d for d, _ in sorted(s.items(), key=lambda x: (-x[1], x[0]))[:k]]
