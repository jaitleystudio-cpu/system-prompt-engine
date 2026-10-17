"""Epistemic Static Single Assignment (ESSA) Graph & Invalidation Engine."""

from __future__ import annotations

from collections import deque
from typing import Any, Dict, List, Optional, Set

from spe_runtime.essa.models import (
    EpistemicNodeType,
    EpistemicStatus,
    ESSANode,
    InvalidationResult,
)


class ESSAGraph:
    """Manages an immutable, versioned semantic dependency graph with cascading invalidation."""

    def __init__(self):
        self.nodes: Dict[str, ESSANode] = {}
        self.def_use: Dict[str, Set[str]] = {}  # reg_id -> set of child reg_ids that consume it
        self._counter: int = 0

    def assign(
        self,
        node_type: EpistemicNodeType,
        content: Any,
        dependencies: Optional[Set[str]] = None,
        status: EpistemicStatus = EpistemicStatus.VALID,
        confidence: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ESSANode:
        """Create a new immutable semantic register ($vN) with explicit provenance dependencies."""
        deps = set(dependencies) if dependencies else set()
        
        # Verify that all dependencies exist
        for dep in deps:
            if dep not in self.nodes:
                raise ValueError(f"Unknown dependency register: {dep}")

        reg_id = f"$v{self._counter}"
        self._counter += 1

        node = ESSANode(
            register_id=reg_id,
            node_type=node_type,
            content=content,
            status=status,
            confidence=confidence,
            dependencies=deps,
            provenance_digest="",
            metadata=metadata or {},
        )
        # Compute and set provenance digest
        digest = node.compute_digest()
        node = ESSANode(
            register_id=reg_id,
            node_type=node_type,
            content=content,
            status=status,
            confidence=confidence,
            dependencies=deps,
            provenance_digest=digest,
            metadata=metadata or {},
        )

        self.nodes[reg_id] = node
        if reg_id not in self.def_use:
            self.def_use[reg_id] = set()

        # Update def-use indices
        for dep in deps:
            self.def_use[dep].add(reg_id)

        return node

    def get(self, register_id: str) -> Optional[ESSANode]:
        """Retrieve a node by its register ID."""
        return self.nodes.get(register_id)

    def compute_downstream_closure(self, root_register: str) -> Set[str]:
        """Compute the transitive closure of all registers depending on root_register."""
        closure: Set[str] = set()
        queue = deque([root_register])

        while queue:
            curr = queue.popleft()
            for child in self.def_use.get(curr, set()):
                if child not in closure:
                    closure.add(child)
                    queue.append(child)

        return closure

    def invalidate(self, register_id: str, reason: str = "Assumption broken") -> InvalidationResult:
        """Selectively invalidates the target register and its entire downstream def-use transitive closure."""
        if register_id not in self.nodes:
            raise KeyError(f"Register {register_id} not found in ESSA graph.")

        downstream = self.compute_downstream_closure(register_id)
        affected = {register_id}.union(downstream)

        # Mark affected nodes as INVALID
        for reg in affected:
            old = self.nodes[reg]
            self.nodes[reg] = ESSANode(
                register_id=old.register_id,
                node_type=old.node_type,
                content=old.content,
                status=EpistemicStatus.INVALID,
                confidence=0.0,
                dependencies=old.dependencies,
                provenance_digest=old.provenance_digest,
                metadata={**old.metadata, "invalidation_reason": reason, "invalidated_by": register_id},
            )

        total_nodes = len(self.nodes)
        invalidated_list = sorted(list(affected))
        preserved_list = sorted([r for r in self.nodes if r not in affected])
        salvaged_ratio = len(preserved_list) / total_nodes if total_nodes > 0 else 0.0

        return InvalidationResult(
            root_cause_register=register_id,
            reason=reason,
            invalidated_registers=invalidated_list,
            preserved_registers=preserved_list,
            salvaged_compute_ratio=round(salvaged_ratio, 4),
        )

    def export_lineage(self, register_id: str) -> List[ESSANode]:
        """Trace backward upstream lineage of dependencies for a given register."""
        if register_id not in self.nodes:
            return []

        lineage: List[ESSANode] = []
        visited: Set[str] = set()
        queue = deque([register_id])

        while queue:
            curr = queue.popleft()
            if curr in visited:
                continue
            visited.add(curr)
            node = self.nodes.get(curr)
            if node:
                lineage.append(node)
                for dep in sorted(list(node.dependencies)):
                    if dep not in visited:
                        queue.append(dep)

        return lineage
