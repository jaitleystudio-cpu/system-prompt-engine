"""G3 Ring-1 durable execution substrate (reference implementation).

WorkerExecutionLease ≠ SemanticProofLease ≠ AuthorityGrant.
Does NOT claim universal exactly-once, physical power-loss safety, or 2PC.
"""

from __future__ import annotations

from spe_runtime.ring1.clock import Clock, SystemClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.effects import (
    EffectState,
    create_effect_intent,
    mark_sent_unknown,
    reconcile_effect,
    record_known_failure,
    record_known_success,
)
from spe_runtime.ring1.lease import (
    acquire_worker_lease,
    heartbeat_worker_lease,
    reclaim_worker_lease,
)
from spe_runtime.ring1.models import DurableMissionState, WorkerLeaseView
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import Ring1Store, open_mission_store, create_new_mission_store, open_existing_mission_store


__all__ = [
    "Clock",
    "SystemClock",
    "Ring1Store",
    "open_mission_store",
    "create_new_mission_store",
    "open_existing_mission_store",
    "acquire_worker_lease",
    "heartbeat_worker_lease",
    "reclaim_worker_lease",
    "commit_durable_semantic_transaction",
    "EffectState",
    "create_effect_intent",
    "mark_sent_unknown",
    "reconcile_effect",
    "record_known_success",
    "record_known_failure",
    "recover_mission",
    "DurableMissionState",
    "WorkerLeaseView",
]
