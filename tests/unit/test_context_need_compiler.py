from spe_runtime.grounding.need import compile_context_need


def test_birthday_message_needs_no_external_context():
    need = compile_context_need("Write a birthday message for my sister")
    assert need.context_types == ("NONE",)
    assert need.max_sources == 0


def test_current_react_migration_prefers_official_docs():
    need = compile_context_need("Create a prompt to migrate this app to the latest React API")
    assert "OFFICIAL_DOCUMENTATION" in need.context_types
    assert "official_docs" in need.required_source_classes
    assert need.freshness_required is True


def test_research_request_requires_scholarly_evidence():
    need = compile_context_need("Research whether blue light affects sleep quality")
    assert "SCHOLARLY_EVIDENCE" in need.context_types
    assert "peer_reviewed" in need.required_source_classes
