"""P4 independent metrics (preregistered in docs/agi-brain/CONTRACT_P4.md). Does NOT import the generator.
Usage: python3 -m spe_runtime.research.agi_brain.metrics_p4 SPE_EXPORT.md BASELINE.md OUT.json"""
from __future__ import annotations
import json, os, random, re, sys, urllib.request
from collections import Counter
import numpy as np

HOST = os.environ.get("SPE_OLLAMA", "http://127.0.0.1:11435"); EMB = "nomic-embed-text"
CORPUS = ["docs/lvt3/CONTRACT.md", "docs/lvt3/PRIOR_ART.md", "docs/lvt3/RESULTS.md", "docs/agi-brain/ARCHITECTURE.md",
          "docs/agi-brain/CONTRACT_R1.md", "docs/agi-brain/RESULTS_R1.md",
          "docs/plans/2026-10-09-csc-counterfactual-specification-closure-plan.md",
          "docs/plans/2026-10-10-wdic-vct-verified-continuation-transactions-plan.md", "docs/ZERO_COST_PRODUCT_LAW.md"]
W = re.compile(r"[A-Za-z][A-Za-z0-9\-]+")
STOP = set("the a an and or of to in on for with is are was were be by as at that this it from not no its their which these can will such also into than more has have been".split())


def embed(texts):
    out = []
    for i in range(0, len(texts), 64):
        body = json.dumps({"model": EMB, "input": [t[:2000] for t in texts[i:i + 64]]}).encode()
        with urllib.request.urlopen(urllib.request.Request(HOST + "/api/embed", body), timeout=600) as r:
            out += json.load(r)["embeddings"]
    a = np.array(out, dtype=np.float32); return a / np.linalg.norm(a, axis=1, keepdims=True)


def corpus_chunks():
    ch = []
    for f in CORPUS:
        ws = open(f, encoding="utf-8").read().split()
        ch += [" ".join(ws[i:i + 200]) for i in range(0, len(ws), 150)]
    return ch


def sections(text, n_units):
    if "\n## " in text:
        parts = re.split(r"\n## ", text)[1:]
        return [p.split("\n", 1)[1] if "\n" in p else p for p in parts], [p.split("\n", 1)[0] for p in parts]
    ws = text.split(); k = max(1, len(ws) // n_units)
    return [" ".join(ws[i:i + k]) for i in range(0, len(ws), k)][:n_units], None


def sentences(t): return [s for s in re.split(r"(?<=[.!?])\s+", t) if len(s.split()) >= 4]
def content(t): return {w.lower() for w in W.findall(t) if w.lower() not in STOP}


def grounding_unit(sec, chunks, chunk_sets):
    claims = [s for s in sentences(sec) if re.search(r"\d", s)]; g = 0
    for s in claims:
        nums = re.findall(r"\d+(?:\.\d+)?", s); cs = content(s)
        for c, cset in zip(chunks, chunk_sets):
            if all(n in c for n in nums) and cs and len(cs & cset) / len(cs) >= 0.3: g += 1; break
    return len(claims), g


def acronyms(text):
    d = {}
    for m in re.finditer(r"((?:[A-Za-z][a-z]+[ -]){1,6})\(([A-Z][A-Z0-9-]{1,8})\)", text):
        exp = " ".join(m.group(1).lower().split()[-len(m.group(2).replace('-', '')):])
        d.setdefault(m.group(2), Counter())[exp] += 1
    return d


def ngrams(ws, n): return [tuple(ws[i:i + n]) for i in range(len(ws) - n + 1)]


def unit_metrics(secs, chunks, chunk_sets):
    rows = []
    for s in secs:
        c, g = grounding_unit(s, chunks, chunk_sets); ws = s.lower().split(); g4 = ngrams(ws, 4)
        rows.append({"claims": c, "grounded": g, "words": len(ws), "distinct4": len(set(g4)) / len(g4) if g4 else 1.0})
    return rows


def doc_metrics(text, n_units, chunks, chunk_sets, corpus_acr):
    secs, titles = sections(text, n_units); rows = unit_metrics(secs, chunks, chunk_sets)
    ws = text.lower().split(); g8 = Counter(ngrams(ws, 8))
    rep8 = sum(v - 1 for v in g8.values() if v > 1) / max(1, sum(g8.values()))
    paras = [p for p in re.split(r"\n\s*\n", text) if len(p.split()) >= 20]
    if len(paras) < 50:  # baseline may lack paragraph breaks: fall back to 120-word windows for both
        paras = [" ".join(ws[i:i + 120]) for i in range(0, len(ws), 120)]
    E = embed(paras); S = E @ E.T; np.fill_diagonal(S, 0)
    iu = np.triu_indices(len(paras), 1); near = int((S[iu] >= 0.95).sum())
    adj = [float(E[i] @ E[i + 1]) for i in range(len(paras) - 1)]
    acr = acronyms(text)
    internal = {k: dict(v) for k, v in acr.items() if len(v) > 1}
    vs_corpus = {k: list(v) for k, v in acr.items() if k in corpus_acr and corpus_acr[k] not in v}
    out = {"words": len(ws), "units": len(secs), "paragraphs": len(paras),
           "claims": sum(r["claims"] for r in rows), "grounded": sum(r["grounded"] for r in rows),
           "grounded_rate": sum(r["grounded"] for r in rows) / max(1, sum(r["claims"] for r in rows)),
           "distinct4_mean": float(np.mean([r["distinct4"] for r in rows])), "repeated_8gram_rate": rep8,
           "near_dup_pairs_cos095": near, "near_dup_per_100_paras": 100 * near / len(paras),
           "adjacent_coherence_mean": float(np.mean(adj)), "acronym_internal_contradictions": len(internal),
           "acronym_contradictions_vs_corpus": len(vs_corpus), "acronym_detail": {"internal": internal, "vs_corpus": vs_corpus}}
    if titles:
        T = embed(titles); B = embed([s[:2000] for s in secs]); out["title_adherence_mean"] = float(np.mean((T * B).sum(1)))
    return out, rows, adj


def boot_diff(a, b, f, n=2000, seed=7):
    r = random.Random(seed); ds = []
    for _ in range(n):
        ra = [r.choice(a) for _ in a]; rb = [r.choice(b) for _ in b]; ds.append(f(ra) - f(rb))
    ds.sort(); return [ds[int(0.025 * n)], ds[int(0.975 * n) - 1]]


def main(spe_path, base_path, out_path):
    chunks = corpus_chunks(); chunk_sets = [content(c) for c in chunks]
    corpus_acr = {k: max(v, key=v.get) for k, v in acronyms(" ".join(chunks)).items()}
    spe_text = open(spe_path, encoding="utf-8").read(); base_text = open(base_path, encoding="utf-8").read()
    spe, srows, sadj = doc_metrics(spe_text, 0, chunks, chunk_sets, corpus_acr)
    base, brows, badj = doc_metrics(base_text, spe["units"], chunks, chunk_sets, corpus_acr)
    gr = lambda rs: sum(r["grounded"] for r in rs) / max(1, sum(r["claims"] for r in rs))
    d4 = lambda rs: sum(r["distinct4"] for r in rs) / len(rs)
    res = {"spe": spe, "baseline": base, "ci95_spe_minus_baseline": {
        "grounded_rate": [gr(srows) - gr(brows), boot_diff(srows, brows, gr)],
        "distinct4_mean": [d4(srows) - d4(brows), boot_diff(srows, brows, d4)],
        "adjacent_coherence": [float(np.mean(sadj) - np.mean(badj)), boot_diff(sadj, badj, lambda x: sum(x) / len(x))]},
        "embedding_model": EMB, "note": "Unit of resampling = section (SPE) / equal-size pseudo-section (baseline); one document per arm."}
    json.dump(res, open(out_path, "w"), indent=1); print(json.dumps({k: v for k, v in res.items() if k != "x"}, indent=1)[:6000])


if __name__ == "__main__":
    main(*sys.argv[1:4])
