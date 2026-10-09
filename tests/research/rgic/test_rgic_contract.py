from spe_runtime.research.rgic.types import (
    ConceptCandidate, ClaimedRole, RepresentationType,
    OperationalMeasurement, ExperimentRegistry, ConceptQualification, TransferMapping
)

def test_rgic_contract_immutability_and_types():
    om = OperationalMeasurement(
        procedure_ref="proc_1",
        required_observations=["obs1"],
        temporal_constraints=[],
        validity_preconditions=[],
        procedure=lambda h: 1
    )
    
    er = ExperimentRegistry(
        permitted_interventions=[],
        preregistration_ref="pre_1",
        independent_evaluator_ref="eval_1"
    )
    
    cq = ConceptQualification(
        scope_ref="scope_1",
        transfer_evidence_refs=[],
        requalification_triggers=[]
    )
    
    cc = ConceptCandidate(
        concept_id="c_1",
        description="desc",
        representation_type=RepresentationType.NUMERIC,
        operational_definition=om,
        claimed_role=ClaimedRole.PREDICTIVE,
        competing_explanations=[],
        registered_predictions=[],
        experiment=er,
        observation_refs=[],
        negative_control_refs=[],
        counterexample_refs=[],
        heldout_result_ref=None,
        qualification=cq,
        protected_intent_ref="prot_1",
        authority_ref="auth_1",
        proof_owner_ref="owner_1"
    )
    
    assert cc.claimed_role == "PREDICTIVE"
    assert cc.representation_type == "NUMERIC"
    assert cc.qualification.status == "UNQUALIFIED"
