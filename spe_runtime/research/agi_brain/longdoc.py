"""R7 slice: long-document job engine (MECHANICS ONLY).
One instruction -> persistent, resumable job -> outline -> section plan -> per-section generation ->
consistency + word-count checks -> one export + claim-status manifest.
Text quality of real long documents is NOT tested here: the only bundled generator is deterministic test text.
Claim statuses: verified (only if its evidence key resolves in the supplied evidence registry), proposed, speculative."""
from __future__ import annotations
import hashlib, json, os, random, re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Protocol

STATUSES = ("verified", "proposed", "speculative")


def words(text: str) -> int:
    return len(re.findall(r"\S+", text))


def _sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _atomic_write(path: str, data: str) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(data); fh.flush(); os.fsync(fh.fileno())
    os.replace(tmp, path)


class Generator(Protocol):
    name: str
    def outline(self, instruction: str, n_sections: int) -> List[str]: ...
    def write_section(self, instruction: str, title: str, target_words: int, context: Dict) -> Dict: ...
    # write_section returns {"text": str, "claims": [{"text":..., "status":..., "evidence": optional key}]}


class DeterministicTestGenerator:
    """Test double. Produces seeded filler that hits the requested word count. Not a writer."""
    name = "deterministic-test-v1"
    VOCAB = "system prompt engine verified evidence section claim method result limit test plan record".split()

    def __init__(self, seed: int = 0, fail_after: Optional[int] = None, drift: float = 0.0):
        self.seed, self.fail_after, self.drift, self.calls = seed, fail_after, drift, 0

    def outline(self, instruction, n_sections):
        return [f"Part {i + 1}: {instruction[:40].strip()} — topic {i + 1}" for i in range(n_sections)]

    def write_section(self, instruction, title, target_words, context):
        if self.fail_after is not None and self.calls >= self.fail_after:
            raise RuntimeError("simulated interruption")
        self.calls += 1
        r = random.Random(f"{self.seed}|{title}")
        n = max(1, int(round(target_words * (1 + self.drift))))
        body = " ".join(r.choice(self.VOCAB) for _ in range(n - 2))
        return {"text": f"Glossary-term SPE. {body}", "claims": [
            {"text": f"{title} cites the frozen contract", "status": "verified", "evidence": "contract_r1"},
            {"text": f"{title} improves outcomes", "status": "verified", "evidence": "missing-key"},
            {"text": f"{title} may generalise", "status": "speculative"}]}


@dataclass
class JobConfig:
    instruction: str
    target_words: int
    n_sections: int
    total_tolerance: float = 0.02
    section_tolerance: float = 0.10
    max_section_retries: int = 2


class LongDocJob:
    def __init__(self, job_dir: str, gen: Generator, evidence: Optional[Dict[str, str]] = None):
        self.dir, self.gen, self.evidence = job_dir, gen, evidence or {}
        self.state_path = os.path.join(job_dir, "job.json")
        os.makedirs(os.path.join(job_dir, "sections"), exist_ok=True)

    # ---- state ----
    def _load(self) -> Optional[Dict]:
        if not os.path.exists(self.state_path): return None
        with open(self.state_path, encoding="utf-8") as fh: return json.load(fh)

    def _save(self, st: Dict) -> None:
        _atomic_write(self.state_path, json.dumps(st, indent=1, sort_keys=True))

    def create(self, cfg: JobConfig) -> Dict:
        st = self._load()
        if st:
            if st["instruction_sha"] != _sha(cfg.instruction): raise ValueError("job dir holds a different instruction")
            return st
        st = {"instruction": cfg.instruction, "instruction_sha": _sha(cfg.instruction), "cfg": cfg.__dict__,
              "generator": self.gen.name, "stage": "created", "outline": [], "plan": [], "sections": {}, "events": []}
        self._save(st); return st

    def _section_path(self, idx: int) -> str:
        return os.path.join(self.dir, "sections", f"{idx:04d}.md")

    def _section_ok(self, st, idx) -> bool:
        rec = st["sections"].get(str(idx)); p = self._section_path(idx)
        if not rec or not os.path.exists(p): return False
        with open(p, encoding="utf-8") as fh: return _sha(fh.read()) == rec["sha"]

    # ---- pipeline ----
    def run(self) -> Dict:
        st = self._load(); assert st, "call create() first"; cfg = st["cfg"]
        if not st["outline"]:
            st["outline"] = self.gen.outline(st["instruction"], cfg["n_sections"])
            if len(st["outline"]) != cfg["n_sections"] or len(set(st["outline"])) != len(st["outline"]):
                raise ValueError("outline must have n_sections unique titles")
            st["stage"] = "outlined"; self._save(st)
        if not st["plan"]:
            base, rem = divmod(cfg["target_words"], cfg["n_sections"])
            st["plan"] = [{"idx": i, "title": t, "target": base + (1 if i < rem else 0)} for i, t in enumerate(st["outline"])]
            st["stage"] = "planned"; self._save(st)
        for item in st["plan"]:
            i = item["idx"]
            if self._section_ok(st, i): continue
            ctx = {"previous_titles": [p["title"] for p in st["plan"][:i]]}
            for attempt in range(cfg["max_section_retries"] + 1):
                out = self.gen.write_section(st["instruction"], item["title"], item["target"], ctx)
                w = words(out["text"])
                if abs(w - item["target"]) <= max(1, cfg["section_tolerance"] * item["target"]): break
                st["events"].append({"section": i, "retry": attempt, "words": w})
            text = f"## {item['title']}\n\n{out['text']}\n"
            _atomic_write(self._section_path(i), text)
            st["sections"][str(i)] = {"sha": _sha(text), "words": w, "claims": [self._grade(c) for c in out["claims"]]}
            st["stage"] = f"generated:{i + 1}/{len(st['plan'])}"; self._save(st)
        return self.finish(st)

    def _grade(self, c: Dict) -> Dict:
        status = c.get("status", "speculative")
        if status not in STATUSES: status = "speculative"
        if status == "verified" and c.get("evidence") not in self.evidence:
            return {**c, "status": "proposed", "downgraded": "evidence key did not resolve"}
        return {**c, "status": status}

    def check(self, st: Dict) -> Dict:
        cfg = st["cfg"]; problems = []
        for item in st["plan"]:
            if not self._section_ok(st, item["idx"]): problems.append(f"missing/corrupt section {item['idx']}")
        total = sum(s["words"] for s in st["sections"].values())
        if abs(total - cfg["target_words"]) > cfg["total_tolerance"] * cfg["target_words"]:
            problems.append(f"total words {total} outside ±{cfg['total_tolerance']:.0%} of {cfg['target_words']}")
        heads = []
        for item in st["plan"]:
            p = self._section_path(item["idx"])
            if os.path.exists(p):
                with open(p, encoding="utf-8") as fh: heads.append(fh.readline().strip())
        if heads != [f"## {t}" for t in st["outline"]]: problems.append("section headings do not match outline order")
        return {"ok": not problems, "problems": problems, "total_words": total}

    def finish(self, st: Dict) -> Dict:
        chk = self.check(st)
        st["checks"] = chk
        if not chk["ok"]:
            st["stage"] = "checks_failed"; self._save(st); return st
        parts = []
        for item in st["plan"]:
            with open(self._section_path(item["idx"]), encoding="utf-8") as fh: parts.append(fh.read())
        doc = f"# {st['instruction']}\n\n" + "\n".join(parts)
        _atomic_write(os.path.join(self.dir, "export.md"), doc)
        claims = [dict(c, section=int(k)) for k, s in sorted(st["sections"].items(), key=lambda kv: int(kv[0])) for c in s["claims"]]
        manifest = {"generator": st["generator"], "export_sha": _sha(doc), "total_words": chk["total_words"],
                    "sections": len(st["plan"]), "claims": claims,
                    "claim_counts": {s: sum(c["status"] == s for c in claims) for s in STATUSES},
                    "quality_note": "Mechanics only. Text quality is not evaluated."}
        _atomic_write(os.path.join(self.dir, "manifest.json"), json.dumps(manifest, indent=1, sort_keys=True))
        st["stage"] = "exported"; self._save(st); return st
