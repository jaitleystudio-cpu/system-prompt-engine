"""Tests for Epistemic Static Single Assignment (ESSA)."""

import pytest
from spe_runtime.essa import (
    ESSAGraph,
    ESSANode,
    EpistemicNodeType,
    EpistemicStatus,
    InvalidationResult,
)


def test_essa_single_assignment_and_provenance():
    graph = ESSAGraph()

    v0 = graph.assign(
        node_type=EpistemicNodeType.CLAIM,
        content="Goal: summarize Q3 revenue report",
        status=EpistemicStatus.VALID,
        confidence=1.0,
    )
    assert v0.register_id == "$v0"
    assert v0.provenance_digest != ""
    assert len(v0.dependencies) == 0

    v1 = graph.assign(
        node_type=EpistemicNodeType.TOOL_RESULT,
        content={"revenue": 14200000, "quarter": "Q3"},
        dependencies={v0.register_id},
        status=EpistemicStatus.VALID,
        confidence=0.98,
    )
    assert v1.register_id == "$v1"
    assert v0.register_id in v1.dependencies
    assert "$v1" in graph.def_use["$v0"]


def test_essa_rejects_nonexistent_dependencies():
    graph = ESSAGraph()
    with pytest.raises(ValueError, match="Unknown dependency register"):
        graph.assign(
            node_type=EpistemicNodeType.CONCLUSION,
            content="Invalid conclusion",
            dependencies={"$v999"},
        )


def test_essa_selective_cascading_invalidation():
    # Construct a diamond dependency graph:
    #         $v0 (root task)
    #        /   \
    #    $v1       $v2 (authority grant)
    #    (price)     |
    #        \     /
    #         $v3 (purchase conclusion)
    graph = ESSAGraph()

    v0 = graph.assign(EpistemicNodeType.CLAIM, "Purchase item X")
    v1 = graph.assign(EpistemicNodeType.OBSERVATION, "Price is $45", dependencies={v0.register_id})
    v2 = graph.assign(EpistemicNodeType.AUTHORITY_GRANT, "Manager approval up to $100", dependencies={v0.register_id})
    v3 = graph.assign(EpistemicNodeType.CONCLUSION, "Execute buy order", dependencies={v1.register_id, v2.register_id})

    # Invalidate $v1 (price changed/expired)
    res: InvalidationResult = graph.invalidate(v1.register_id, reason="Price quote expired after 15m")

    assert res.root_cause_register == "$v1"
    assert "$v1" in res.invalidated_registers
    assert "$v3" in res.invalidated_registers  # Dependent conclusion must be invalidated!
    assert "$v0" not in res.invalidated_registers  # Root claim preserved
    assert "$v2" not in res.invalidated_registers  # Orthogonal manager authority preserved!

    # Check status in graph
    assert graph.get("$v1").status == EpistemicStatus.INVALID
    assert graph.get("$v3").status == EpistemicStatus.INVALID
    assert graph.get("$v0").status == EpistemicStatus.VALID
    assert graph.get("$v2").status == EpistemicStatus.VALID

    # Salvaged compute ratio should reflect that 2 out of 4 nodes remained valid
    assert res.salvaged_compute_ratio == 0.5


def test_essa_lineage_export():
    graph = ESSAGraph()
    v0 = graph.assign(EpistemicNodeType.CLAIM, "Start pipeline")
    v1 = graph.assign(EpistemicNodeType.OBSERVATION, "Step 1 complete", dependencies={v0.register_id})
    v2 = graph.assign(EpistemicNodeType.CONCLUSION, "Final summary", dependencies={v1.register_id})

    lineage = graph.export_lineage(v2.register_id)
    lineage_ids = [n.register_id for n in lineage]
    assert "$v2" in lineage_ids
    assert "$v1" in lineage_ids
    assert "$v0" in lineage_ids
