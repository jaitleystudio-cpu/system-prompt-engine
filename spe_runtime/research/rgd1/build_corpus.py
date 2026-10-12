"""Build the frozen R03 task set + local retrieval corpus from OpenAlex (filter/sample calls, 1 credit each).
Usage: python -m spe_runtime.research.rgd1.build_corpus OUT_DIR"""
import hashlib, json, os, random, sys
from collections import Counter
from .openalex import OpenAlex, text_of

import re
LEAK = re.compile(r"\b(retract(ed|ion)?|withdrawn|withdrawal|expression of concern|erratum|corrigendum)\b[:\s]*", re.I)


def sanitize(s: str) -> str:
    """Remove answer-leaking status markers (e.g. OpenAlex titles prefixed 'RETRACTED:') from task inputs."""
    s = re.sub(r"^\s*[\[\(]?\s*(retracted|withdrawn)\s*(article)?\s*[\]\)]?\s*[:\-]?\s*", "", s, flags=re.I)
    return LEAK.sub("", s).strip()


SEL = "id,title,type,referenced_works,abstract_inverted_index,primary_topic,publication_year,is_retracted"


def main(out):
    os.makedirs(out, exist_ok=True); oa = OpenAlex()
    notices = {}
    for seed in (1, 2, 3):
        for w in oa.get("/works", filter="type:retraction,referenced_works_count:1", sample=200, seed=seed,
                        per_page=200, select=SEL)["results"]:
            notices[w["id"]] = w
    orig_ids = sorted({n["referenced_works"][0] for n in notices.values()})
    originals = {}
    for i in range(0, len(orig_ids), 50):
        chunk = "|".join(x.rsplit("/", 1)[1] for x in orig_ids[i:i + 50])
        for w in oa.get("/works", filter=f"openalex:{chunk}", per_page=50, select=SEL)["results"]:
            originals[w["id"]] = w
    tasks = []
    for nid, n in sorted(notices.items()):
        o = originals.get(n["referenced_works"][0])
        if not o or not o.get("is_retracted") or o.get("type") == "retraction" or not (o.get("title") or "").strip():
            continue
        field = ((o.get("primary_topic") or {}).get("field") or {}).get("display_name") or "Unknown"
        tasks.append({"task_id": "T" + o["id"].rsplit("/", 1)[1], "kind": "retracted", "original_id": o["id"],
                      "gold_ids": [nid], "family": field, "query_title": sanitize(o["title"]), "query_text": sanitize(text_of(o)),
                      "input_was_sanitized": sanitize(text_of(o)) != text_of(o)})
    # one task per original (dedupe), keep all notices of that original as gold
    by_o = {}
    for t in tasks:
        if t["original_id"] in by_o: by_o[t["original_id"]]["gold_ids"] += t["gold_ids"]
        else: by_o[t["original_id"]] = t
    tasks = list(by_o.values())
    fields = Counter(t["family"] for t in tasks)
    field_ids = {}
    for o in originals.values():
        f = ((o.get("primary_topic") or {}).get("field") or {})
        if f.get("id"): field_ids[f["display_name"]] = f["id"].rsplit("/", 1)[1]
    distract = {}
    for fname, fid in sorted(field_ids.items()):
        for w in oa.get("/works", filter=f"primary_topic.field.id:{fid},type:article,is_retracted:false",
                        sample=300, seed=7, per_page=200, select=SEL)["results"]:
            distract[w["id"]] = w
    # negative control: non-retracted articles (truth: no decision-changing notice exists)
    rng = random.Random("rgd1-negctl")
    pool = sorted(distract)
    controls = []
    for wid in rng.sample(pool, 120):
        w = distract[wid]
        field = ((w.get("primary_topic") or {}).get("field") or {}).get("display_name") or "Unknown"
        if (w.get("title") or "").strip():
            controls.append({"task_id": "C" + wid.rsplit("/", 1)[1], "kind": "control", "original_id": wid, "gold_ids": [],
                             "family": field, "query_title": sanitize(w["title"]), "query_text": sanitize(text_of(w)),
                             "input_was_sanitized": sanitize(text_of(w)) != text_of(w)})
    corpus = {}
    for d in (notices, originals, distract):
        for k, w in d.items():
            corpus[k] = {"id": k, "type": w.get("type"), "title": w.get("title") or "", "text": text_of(w)}
    rng = random.Random("rgd1-split")
    tasks.sort(key=lambda t: t["task_id"]); rng.shuffle(tasks)
    for i, t in enumerate(tasks): t["split"] = "dev" if i < 40 else "holdout"
    controls.sort(key=lambda t: t["task_id"]); rng.shuffle(controls)
    for i, t in enumerate(controls): t["split"] = "dev" if i < 20 else "holdout"
    with open(os.path.join(out, "corpus.jsonl"), "w") as fh:
        for k in sorted(corpus): fh.write(json.dumps(corpus[k], sort_keys=True) + "\n")
    with open(os.path.join(out, "tasks.jsonl"), "w") as fh:
        for t in tasks + controls: fh.write(json.dumps(t, sort_keys=True) + "\n")
    h = lambda p: hashlib.sha256(open(os.path.join(out, p), "rb").read()).hexdigest()
    meta = {"n_notices": len(notices), "n_originals": len(originals), "n_tasks_retracted": len(tasks),
            "n_controls": len(controls), "n_corpus": len(corpus), "n_distractors": len(distract),
            "families": dict(fields), "corpus_sha256": h("corpus.jsonl"), "tasks_sha256": h("tasks.jsonl"),
            "credits_used_this_build": oa.credits}
    json.dump(meta, open(os.path.join(out, "manifest.json"), "w"), indent=1); print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
