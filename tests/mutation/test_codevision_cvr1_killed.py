"""Kill CVR1-01 through CVR1-20 against the donor CODEVISION structure IR."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.codevision.compiler import compile_structure
from spe_runtime.codevision.errors import CodevisionContractError
from spe_runtime.codevision.proof import (
    build_visual_fidelity_proof,
    load_visual_fidelity_proof,
)
from tests.mutation.cvr1_harness import (
    MUTANT_IDS,
    PROOF_SCHEMA_INVALID,
    STRUCTURE_SCHEMA_INVALID,
    Snapshot,
    added_hard_constraint_compile,
    apply_mutant,
    build_donor_snapshot,
    qualify,
    rich_observation,
    substituted_source_compile,
)

_ROOT = Path(__file__).resolve().parents[2]
_SCHEMAS = _ROOT / "schemas"


@pytest.fixture(scope="module")
def donor():
    return build_donor_snapshot()


@pytest.fixture(scope="module")
def structure_schema():
    return json.loads(
        (_SCHEMAS / "codevision_structure.schema.json").read_text(encoding="utf-8")
    )


def test_donor_snapshot_has_no_cvr1_defect(donor):
    assert qualify(donor) == set()


@pytest.mark.parametrize("mutant_id", MUTANT_IDS)
def test_mutant_is_killed(donor, mutant_id):
    mutant = apply_mutant(donor, mutant_id)
    codes = qualify(mutant)
    assert mutant_id in codes
    assert qualify(donor) == set()


def test_all_twenty_mutants_are_killed_and_donor_is_not(donor):
    killed = {
        mutant_id: qualify(apply_mutant(donor, mutant_id)) for mutant_id in MUTANT_IDS
    }
    assert list(killed) == list(MUTANT_IDS)
    assert all(mutant_id in codes and codes for mutant_id, codes in killed.items())
    assert qualify(donor) == set()


@pytest.mark.parametrize("mutant_id", MUTANT_IDS)
def test_schema_does_not_replace_the_oracle(donor, structure_schema, mutant_id):
    mutant = apply_mutant(donor, mutant_id)
    if mutant_id in STRUCTURE_SCHEMA_INVALID:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(mutant.document, structure_schema)
    else:
        jsonschema.validate(mutant.document, structure_schema)
    if mutant_id in PROOF_SCHEMA_INVALID:
        with pytest.raises(CodevisionContractError) as caught:
            load_visual_fidelity_proof(mutant.proof)
        if mutant_id == "CVR1-18":
            assert caught.value.reason == "PROOF_FIELD_UNKNOWN"
        else:
            assert caught.value.reason == "FIDELITY_CLAIM_FORBIDDEN"
    else:
        loaded = load_visual_fidelity_proof(mutant.proof)
        assert loaded.visual_fidelity_status == "UNPROVEN"
        assert loaded.visual_fidelity_proven is False


def test_added_hard_constraint_is_not_the_donor():
    observation = rich_observation()
    compiled = compile_structure(observation)
    assert compiled.to_dict()["targets"]["element_inventory"]["kind_counts"]["unknown"] == 1
    with pytest.raises(CodevisionContractError) as caught:
        added_hard_constraint_compile(observation)
    assert caught.value.reason == "DESKTOP_VIEWPORT_REQUIRED"


def test_unsupported_source_substitution_is_killed():
    observation = rich_observation()
    observation["source_kind"] = "not_a_target"
    with pytest.raises(CodevisionContractError) as caught:
        compile_structure(observation)
    assert caught.value.reason == "SOURCE_KIND_REJECTED"
    forged = substituted_source_compile(observation)
    proof = build_visual_fidelity_proof(forged, "proof-substituted")
    snapshot = Snapshot(
        observation=observation,
        document=forged.to_dict(),
        proof=proof.to_dict(),
    )
    assert "CVR1-16" in qualify(snapshot)
