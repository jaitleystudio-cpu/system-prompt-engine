"""R0: record corpus counts as returned by the OpenAlex API (no claims beyond the numbers)."""
import json, sys, time
from .openalex import OpenAlex
oa = OpenAlex()
out = {"retrieved_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": "api.openalex.org (keyless, mailto polite pool)"}
out["works_total"] = oa.get("/works", per_page=1)["meta"]["count"]
for g in ("type", "is_retracted", "has_fulltext"):
    r = oa.get("/works", group_by=g, per_page=200)
    out[f"by_{g}"] = {x["key_display_name"] or x["key"]: x["count"] for x in r["group_by"]}
out["retraction_type_works"] = oa.get("/works", filter="type:retraction", per_page=1)["meta"]["count"]
json.dump(out, open(sys.argv[1], "w"), indent=1); print(json.dumps(out, indent=1))
