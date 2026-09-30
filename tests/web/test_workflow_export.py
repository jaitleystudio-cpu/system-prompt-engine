"""Lane A8: Workflow Export UX and Offline Contracts Invariants."""

from __future__ import annotations

import re
from tests.web.paths import WEB


def test_workflow_export_files_exist():
    exporters_ts = WEB / "src" / "export" / "workflowExporters.ts"
    modal_tsx = WEB / "src" / "export" / "WorkflowExportModal.tsx"
    export_css = WEB / "src" / "export" / "workflow-export.css"

    assert exporters_ts.is_file(), "workflowExporters.ts must exist"
    assert modal_tsx.is_file(), "WorkflowExportModal.tsx must exist"
    assert export_css.is_file(), "workflow-export.css must exist"


def test_workflow_export_contract_and_receipt():
    exporters_ts = WEB / "src" / "export" / "workflowExporters.ts"
    modal_tsx = WEB / "src" / "export" / "WorkflowExportModal.tsx"
    export_css = WEB / "src" / "export" / "workflow-export.css"

    if not exporters_ts.is_file():
        return

    exporters_content = exporters_ts.read_text(encoding="utf-8")
    modal_content = modal_tsx.read_text(encoding="utf-8")
    css_content = export_css.read_text(encoding="utf-8")

    # 4 platforms
    for plat in ("n8n", "make", "zapier", "generic"):
        assert f'"{plat}"' in exporters_content or f"'{plat}'" in exporters_content, f"Missing platform {plat}"
        assert f'"{plat}"' in modal_content or f"'{plat}'" in modal_content, f"Missing platform {plat} in UI"

    # Receipt fields
    for field in ("preservedFields", "transformedFields", "unsupportedFields", "manualStepsRequired"):
        assert field in exporters_content, f"Missing receipt field {field} in exporters"
        assert field in modal_content, f"Missing receipt field {field} in UI"

    # CSS accessibility & touch targets
    assert "44px" in css_content, "Missing 44px touch targets in workflow-export.css"
    assert ":focus-visible" in css_content, "Missing :focus-visible in workflow-export.css"
    assert "prefers-reduced-motion" in css_content, "Missing prefers-reduced-motion in workflow-export.css"


def test_workflow_export_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    routing_ts = (WEB / "src" / "routing.ts").read_text(encoding="utf-8")

    assert "<WorkflowExportModal" not in app_tsx, "WorkflowExportModal must not be mounted into App.tsx yet"
    assert "workflow-export" not in routing_ts, "workflow-export must not be in routing.ts yet"
