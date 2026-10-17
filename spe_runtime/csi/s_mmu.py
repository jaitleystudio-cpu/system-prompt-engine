"""Semantic Memory Management Unit (S-MMU) & Paged Epistemic Virtual Memory (PEVM).

Manages the Epistemic Address Space (EAS), extracts minimal working-set pages
via causal dependency closures, and handles Semantic Page Fault interrupts.
"""

from __future__ import annotations

import threading
import uuid
from collections import deque
from typing import Any, Callable, Dict, List, Optional, Set

from .models import LatticeState, PageFaultInterrupt, SemanticRegister, SemanticWorkingSet


class SemanticMMU:
    """Hardware-inspired memory management unit for semantic registers and epistemic paging."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.eas: Dict[str, SemanticRegister] = {}  # reg_id -> latest SemanticRegister
        self.consumers: Dict[str, Set[str]] = {}    # reg_id -> set of dependent reg_ids
        self.history: Dict[str, List[SemanticRegister]] = {}  # reg_id -> list of versions

    def allocate_register(
        self,
        reg_id: str,
        term: Any,
        dependencies: Optional[List[str]] = None,
        validity_predicate: Optional[Callable[[Any], bool]] = None,
        authority_lease: Optional[str] = None,
        provenance: Optional[Dict[str, Any]] = None,
    ) -> SemanticRegister:
        """Allocates an immutable register in the Epistemic Address Space."""
        with self._lock:
            deps = dependencies or []
            reg = SemanticRegister(
                reg_id=reg_id,
                term=term,
                version=1,
                dependencies=deps,
                validity_predicate=validity_predicate,
                authority_lease=authority_lease,
                lattice_state=LatticeState.VALID,
                provenance=provenance or {},
            )
            self.eas[reg_id] = reg
            self.history[reg_id] = [reg]

            # Index def-use consumers
            for d in deps:
                if d not in self.consumers:
                    self.consumers[d] = set()
                self.consumers[d].add(reg_id)

            return reg

    def update_register(
        self,
        reg_id: str,
        new_term: Any,
        new_dependencies: Optional[List[str]] = None,
        authority_lease: Optional[str] = None,
    ) -> Tuple[SemanticRegister, Set[str]]:
        """Updates register to a new monotonic version and invalidates downstream consumers.
        Returns the new register and the set of invalidated downstream register IDs.
        """
        with self._lock:
            if reg_id not in self.eas:
                reg = self.allocate_register(reg_id, new_term, new_dependencies, authority_lease=authority_lease)
                return reg, set()

            old_reg = self.eas[reg_id]
            new_version = old_reg.version + 1
            deps = new_dependencies if new_dependencies is not None else old_reg.dependencies

            new_reg = SemanticRegister(
                reg_id=reg_id,
                term=new_term,
                version=new_version,
                dependencies=deps,
                validity_predicate=old_reg.validity_predicate,
                authority_lease=authority_lease or old_reg.authority_lease,
                lattice_state=LatticeState.VALID,
                provenance={"supersedes_version": old_reg.version},
            )
            self.eas[reg_id] = new_reg
            self.history[reg_id].append(new_reg)

            # Transitive invalidation of dependent registers
            invalidated: Set[str] = set()
            queue = deque(self.consumers.get(reg_id, set()))
            while queue:
                consumer_id = queue.popleft()
                if consumer_id not in invalidated and consumer_id in self.eas:
                    invalidated.add(consumer_id)
                    consumer_reg = self.eas[consumer_id]
                    consumer_reg.lattice_state = LatticeState.INVALID
                    # Propagate further downstream
                    for next_consumer in self.consumers.get(consumer_id, set()):
                        if next_consumer not in invalidated:
                            queue.append(next_consumer)

            return new_reg, invalidated

    def get_register(self, reg_id: str) -> Optional[SemanticRegister]:
        with self._lock:
            return self.eas.get(reg_id)

    def page_working_set(
        self,
        goal_register_ids: List[str],
        pinned_obligations: Optional[List[str]] = None,
        page_id: Optional[str] = None,
    ) -> SemanticWorkingSet:
        """Extracts minimal dependency closure page (PEVM) for a given set of goals."""
        with self._lock:
            pid = page_id or f"page-{uuid.uuid4().hex[:8]}"
            pinned = pinned_obligations or []
            selected_registers: Dict[str, SemanticRegister] = {}

            # Transitive dependency closure
            queue = deque(goal_register_ids)
            visited: Set[str] = set()

            while queue:
                curr_id = queue.popleft()
                if curr_id in visited:
                    continue
                visited.add(curr_id)

                reg = self.eas.get(curr_id)
                if reg:
                    selected_registers[curr_id] = reg
                    for dep in reg.dependencies:
                        if dep not in visited:
                            queue.append(dep)

            # Estimate token footprint (~45 tokens per register)
            est_tokens = len(selected_registers) * 45 + len(pinned) * 20

            return SemanticWorkingSet(
                page_id=pid,
                registers=selected_registers,
                pinned_obligations=pinned,
                estimated_tokens=est_tokens,
            )

    def resolve_page_fault(self, page: SemanticWorkingSet, reg_id: str) -> SemanticRegister:
        """Handles a Semantic Page Fault by dynamically mounting the missing register from EAS."""
        with self._lock:
            if reg_id not in self.eas:
                raise KeyError(f"Semantic Page Fault Unresolvable: Register '{reg_id}' does not exist in EAS.")
            reg = self.eas[reg_id]
            page.registers[reg_id] = reg
            page.estimated_tokens += 45
            return reg
