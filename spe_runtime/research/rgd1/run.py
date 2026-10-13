"""R03 runner. Usage:
  python -m spe_runtime.research.rgd1.run SPLIT OUT_DIR [--expect-prereg-sha SHA] [--oa-n N]
Arms (local arms: identical frozen corpus, K=10, <=3 index queries/task):
  B1     BM25, 1 query (title)
  B2     BM25 top-100 (title) reranked by local nomic-embed-text cosine vs title+abstract, 1 query
  R03    decision-reversal: qwen2.5:1.5b writes 3 reversal-seeking queries, BM25 each, RRF fusion
  R03T   template ablation: 'retraction|contradicts|failed replication' + title, BM25 each, RRF
  OA     OpenAlex live relevance search (title, 1 call, top 10). Secondary; first N retracted tasks only (keyless budget)"""
from __future__ import annotations
import hashlib, json, os, re, subprocess, sys, time, urllib.error
from .retrieval import BM25, EmbedCache, cos, gen_queries, rrf
from .openalex import OpenAlex

K = 10
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
FROZEN = os.path.join(REPO, "evidence", "rgd1", "frozen")
PREREG = os.path.join(REPO, "docs", "rgd1", "PREREG.md")
CACHE = os.path.join(REPO, "data", "rgd1_cache")


def main():
    a = sys.argv[1:]; split, out = a[0], a[1]
    sha = a[a.index("--expect-prereg-sha") + 1] if "--expect-prereg-sha" in a else None
    oa_n = int(a[a.index("--oa-n") + 1]) if "--oa-n" in a else 0
    if split == "holdout":
        if not os.path.exists(PREREG): sys.exit("REFUSED: no PREREG")
        act = hashlib.sha256(open(PREREG, "rb").read()).hexdigest()
        dirty = subprocess.run(["git", "status", "--porcelain", "--", PREREG, os.path.dirname(__file__), FROZEN],
                               cwd=REPO, capture_output=True, text=True).stdout.strip()
        if act != sha or dirty: sys.exit(f"REFUSED: prereg {act} != {sha} or dirty {dirty!r}")
    corpus = [json.loads(l) for l in open(os.path.join(FROZEN, "corpus.jsonl"))]
    ctype = {d["id"]: d["type"] for d in corpus}; ctext = {d["id"]: d["text"] for d in corpus}
    tasks = [json.loads(l) for l in open(os.path.join(FROZEN, "tasks.jsonl"))]
    tasks = [t for t in tasks if t["split"] == split]
    os.makedirs(CACHE, exist_ok=True)  # fix (Bro replay 2026-10-13): fresh checkout crashed on missing data/rgd1_cache/
    bm = BM25(corpus); emb = EmbedCache(os.path.join(CACHE, "emb.jsonl"))
    oa = OpenAlex(max_credits=950) if oa_n else None
    os.makedirs(out, exist_ok=True); rows = []; n_oa = 0
    for t in tasks:
        res = {}
        t0 = time.time(); r = [d for d, _ in bm.search(t["query_title"], K)]
        res["B1"] = (r, 1, time.time() - t0, 0)
        t0 = time.time(); cand = [d for d, _ in bm.search(t["query_title"], 100)]
        qv = emb.get(t["query_title"], "search_query: ")  # title only (abstracts of retracted works can leak notice text)
        r = sorted(cand, key=lambda d: (-cos(qv, emb.get(ctext[d], "search_document: ")), d))[:K]
        res["B2"] = (r, 1, time.time() - t0, 0)
        qs, glat = gen_queries(t["query_title"], os.path.join(CACHE, "gen.jsonl"))
        t0 = time.time(); r = rrf([[d for d, _ in bm.search(q, K)] for q in qs[:3]], K)
        res["R03"] = (r, len(qs[:3]), time.time() - t0 + glat, 0, qs)
        tq = [f"retraction {t['query_title']}", f"contradicts {t['query_title']}", f"failed replication {t['query_title']}"]
        t0 = time.time(); r = rrf([[d for d, _ in bm.search(q, K)] for q in tq], K)
        res["R03T"] = (r, 3, time.time() - t0, 0)
        if oa and t["kind"] == "retracted" and n_oa < oa_n:
            # Post-freeze fix (disclosed in PREREG_ADDENDUM_INTERRUPTION.md): OpenAlex returned HTTP 400 for some raw
            # titles; on 400 retry once with punctuation removed; if that fails too, score the OA task as a miss (error).
            t0 = time.time(); calls = 0
            try:
                j = oa.get("/works", search=t["query_title"], per_page=K, select="id,type"); calls = 1
            except urllib.error.HTTPError as e:
                if e.code != 400: raise
                try:
                    j = oa.get("/works", search=re.sub(r"[^A-Za-z0-9 ]+", " ", t["query_title"]), per_page=K, select="id,type"); calls = 2
                except urllib.error.HTTPError:
                    j = {"results": [], "_rgd1_fetch": {"credits_used": 0}, "_error": True}; calls = 2
            res["OA"] = ([w["id"] for w in j["results"]][:K], calls, time.time() - t0, j.get("_rgd1_fetch", {}).get("credits_used", 0))
            n_oa += 1
        gold = set(t["gold_ids"])
        for arm, v in res.items():
            r = v[0]; ret = [d for d in r if (ctype.get(d) == "retraction")] if arm != "OA" else []
            rows.append({"task": t["task_id"], "kind": t["kind"], "family": t["family"], "split": split, "arm": arm,
                         "hit": bool(gold & set(r)), "gold_rank": min([r.index(g) + 1 for g in gold if g in r], default=None),
                         "n_retraction_docs": len(ret) if arm != "OA" else None,
                         "any_retraction_doc": bool(ret) if arm != "OA" else None,
                         "queries": v[1], "latency_s": round(v[2], 4), "api_credits": v[3],
                         "gen_queries": v[4] if len(v) > 4 else None, "top": r})
    with open(os.path.join(out, "rows.jsonl"), "w") as fh:
        for r in rows: fh.write(json.dumps(r) + "\n")
    json.dump({t["task_id"]: t["gold_ids"] for t in tasks}, open(os.path.join(out, "gold_map.json"), "w"))
    json.dump({"split": split, "n_tasks": len(tasks), "oa_calls": n_oa, "oa_credits": oa.credits if oa else 0},
              open(os.path.join(out, "meta.json"), "w"), indent=1)
    print("done", len(rows))


if __name__ == "__main__":
    main()
