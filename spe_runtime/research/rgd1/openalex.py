"""Minimal OpenAlex adapter: polite pool (mailto), no API key, disk cache, rate limit,
budget guard. Keyless OpenAlex now has a $0.10/day usage allowance (search = 10 credits,
list/filter/group_by = 1, singleton = 0). Requests beyond the allowance are refused (HTTP 429),
never billed: no key, no prepaid balance -> spend is structurally Rs 0. Every call is logged."""
from __future__ import annotations
import hashlib, json, os, time, urllib.parse, urllib.request
from typing import Any, Dict, Optional

BASE = "https://api.openalex.org"
MAILTO = os.environ.get("RGD1_MAILTO", "jaitleystudio@gmail.com")
CACHE = os.environ.get("RGD1_CACHE", os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "rgd1_cache"))
MIN_INTERVAL_S = 0.25  # <= 4 req/s (OpenAlex limit is 100/s)


class OpenAlex:
    def __init__(self, cache_dir: str = CACHE, log_path: Optional[str] = None, max_credits: int = 900):
        self.cache_dir = os.path.abspath(cache_dir); os.makedirs(self.cache_dir, exist_ok=True)
        self.log_path = log_path or os.path.join(self.cache_dir, "calls.jsonl")
        self.max_credits = max_credits; self.credits = 0; self._last = 0.0

    def _key(self, path, params):
        return hashlib.sha256((path + "?" + urllib.parse.urlencode(sorted(params.items()))).encode()).hexdigest()

    def get(self, path: str, **params) -> Dict[str, Any]:
        params = {k: v for k, v in params.items() if v is not None}
        fp = os.path.join(self.cache_dir, self._key(path, params) + ".json")
        if os.path.exists(fp):
            return json.load(open(fp))
        q = dict(params, mailto=MAILTO)
        url = f"{BASE}{path}?{urllib.parse.urlencode(q)}"
        wait = MIN_INTERVAL_S - (time.time() - self._last)
        if wait > 0: time.sleep(wait)
        if self.credits >= self.max_credits:
            raise RuntimeError(f"local credit guard reached ({self.credits})")
        req = urllib.request.Request(url, headers={"User-Agent": f"SPE-RGD1-research (mailto:{MAILTO})"})
        t0 = time.time()
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.loads(r.read()); h = {k.lower(): v for k, v in r.headers.items()}
        self._last = time.time()
        used = int(h.get("x-ratelimit-credits-used", "0") or 0); self.credits += used
        rec = {"ts_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "path": path, "params": params,
               "credits_used": used, "cost_usd_header": h.get("x-ratelimit-cost-usd"),
               "remaining_usd": h.get("x-ratelimit-remaining-usd"), "prepaid_remaining_usd": h.get("x-ratelimit-prepaid-remaining-usd"),
               "latency_s": round(time.time() - t0, 3), "cache_file": os.path.basename(fp)}
        with open(self.log_path, "a") as fh: fh.write(json.dumps(rec) + "\n")
        body["_rgd1_fetch"] = rec
        json.dump(body, open(fp, "w"))
        return body


def text_of(w: Dict[str, Any]) -> str:
    inv = w.get("abstract_inverted_index") or {}
    pos = sorted((p, t) for t, ps in inv.items() for p in ps)
    return ((w.get("title") or w.get("display_name") or "") + " . " + " ".join(t for _, t in pos)).strip()
