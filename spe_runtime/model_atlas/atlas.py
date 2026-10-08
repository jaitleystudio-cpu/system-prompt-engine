"""Model Atlas Registry and comparison engine."""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .models import ExecutionClass, ExecutionProvenance, ModelAtlas, ModelPassport


class RemoteExecutionNotPermittedError(Exception):
    """Raised when remote execution is requested without explicit opt-in."""


class ModelAtlasRegistry:
    def __init__(self, storage_path: Path | str | None = None) -> None:
        self.storage_path = Path(storage_path) if storage_path else None
        self.atlas = ModelAtlas()
        if self.storage_path and self.storage_path.exists():
            self._load()

    def record_execution(
        self,
        prov: ExecutionProvenance,
        allow_remote: bool = False,
    ) -> None:
        if prov.execution_class == ExecutionClass.OBSERVED_REMOTE and not allow_remote:
            raise RemoteExecutionNotPermittedError(
                "Remote model execution requires explicit opt-in (allow_remote=True). "
                "SPE never transmits private prompts externally by default."
            )

        self.atlas.provenance_log.append(prov)
        self._update_passport_from_provenance(prov)
        if self.storage_path:
            self._save()

    def get_passport(self, model_id: str) -> ModelPassport | None:
        return self.atlas.passports.get(model_id)

    def _update_passport_from_provenance(self, prov: ExecutionProvenance) -> None:
        p = self.atlas.passports.get(prov.model_id)
        if p is None:
            p = ModelPassport(
                model_id=prov.model_id,
                provider=prov.provider,
                passport_version="0.1.0",
                execution_class=prov.execution_class,
                structured_output_success=prov.score if prov.score > 0 else 0.0,
                constraint_retention=prov.score,
                tool_argument_validity=prov.score,
                long_context_recall=prov.score,
                latency_p50_ms=prov.latency_ms,
                latency_p95_ms=prov.latency_ms * 1.5,
                cost_per_million_input=prov.cost_usd * 1000,
                cost_per_million_output=prov.cost_usd * 2000,
                last_tested=prov.timestamp,
                sample_count=1,
            )
            self.atlas.passports[prov.model_id] = p
        else:
            # Incremental moving average
            n = p.sample_count
            p.structured_output_success = round((p.structured_output_success * n + prov.score) / (n + 1), 3)
            p.latency_p50_ms = round((p.latency_p50_ms * n + prov.latency_ms) / (n + 1), 1)
            p.sample_count += 1
            p.last_tested = prov.timestamp
            if prov.failure_id:
                p.known_failure_clusters.append(prov.failure_id)

    def _save(self) -> None:
        if not self.storage_path:
            return
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "passports": {mid: asdict(mp) for mid, mp in self.atlas.passports.items()},
            "provenance_log": [asdict(ep) for ep in self.atlas.provenance_log],
        }
        self.storage_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _load(self) -> None:
        if not self.storage_path or not self.storage_path.exists():
            return
        try:
            data = json.loads(self.storage_path.read_text(encoding="utf-8"))
            for mid, mdata in data.get("passports", {}).items():
                mdata["execution_class"] = ExecutionClass(mdata["execution_class"])
                self.atlas.passports[mid] = ModelPassport(**mdata)
            for pdata in data.get("provenance_log", []):
                pdata["execution_class"] = ExecutionClass(pdata["execution_class"])
                self.atlas.provenance_log.append(ExecutionProvenance(**pdata))
        except Exception:
            pass


def compare_model_passports(p1: ModelPassport, p2: ModelPassport) -> dict[str, Any]:
    return {
        "model_a": p1.model_id,
        "model_b": p2.model_id,
        "execution_class_a": p1.execution_class.value,
        "execution_class_b": p2.execution_class.value,
        "metrics_diff": {
            "structured_output_delta": round(p2.structured_output_success - p1.structured_output_success, 3),
            "constraint_retention_delta": round(p2.constraint_retention - p1.constraint_retention, 3),
            "latency_p50_delta_ms": round(p2.latency_p50_ms - p1.latency_p50_ms, 1),
            "cost_input_ratio": round(p2.cost_per_million_input / p1.cost_per_million_input, 2) if p1.cost_per_million_input else None,
        },
        "sample_counts": {p1.model_id: p1.sample_count, p2.model_id: p2.sample_count},
    }
