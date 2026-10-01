"""Lane A8: workflow export UI consumes G11 documents and does not project them."""

from __future__ import annotations

from tests.web.paths import WEB


def test_workflow_export_files_exist():
    view_model = WEB / "src" / "export" / "workflowExportViewModel.ts"
    modal = WEB / "src" / "export" / "WorkflowExportModal.tsx"
    export_css = WEB / "src" / "export" / "workflow-export.css"
    old_engine = WEB / "src" / "export" / "workflowExporters.ts"

    assert view_model.is_file()
    assert modal.is_file()
    assert export_css.is_file()
    assert not old_engine.exists()


def test_workflow_export_is_display_only():
    view_model = (WEB / "src" / "export" / "workflowExportViewModel.ts").read_text(encoding="utf-8")
    modal = (WEB / "src" / "export" / "WorkflowExportModal.tsx").read_text(encoding="utf-8")
    css = (WEB / "src" / "export" / "workflow-export.css").read_text(encoding="utf-8")
    fixtures = (WEB / "src" / "export" / "workflowExportFixtures.ts").read_text(encoding="utf-8")

    assert "spe.workflow-export.v1" in view_model
    assert 'LIVE_IMPORT_STATUS = "UNVERIFIED"' in view_model
    assert "TEST_FIXTURES_ONLY" in fixtures
    assert "workflowExporters" not in modal
    assert "exportToN8n" not in view_model
    assert "n8n-nodes-base.webhook" not in view_model
    assert "works in n8n" not in modal
    assert "Zapier compatible" not in modal
    for field in ("loss_state", "fidelity", "warnings", "stripped_paths", "target_document"):
        assert field in view_model
    assert "44px" in css
    assert ":focus-visible" in css
    assert "prefers-reduced-motion" in css


def test_workflow_export_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "<WorkflowExportModal" not in app_tsx
    assert "workflow-export" not in routing_ts
