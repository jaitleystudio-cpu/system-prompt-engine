"""Lane A7: Project Library UI automated qualification test suite."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "apps" / "web"


def test_project_library_files_exist():
    assert (REPO / "schemas" / "project_library.schema.json").is_file()
    assert (WEB / "src" / "library" / "projectLibraryModel.ts").is_file()
    assert (WEB / "src" / "library" / "project-library.css").is_file()
    assert (WEB / "src" / "library" / "ProjectLibraryView.tsx").is_file()
    assert (WEB / "scripts" / "test-project-library-ui.mjs").is_file()


def test_project_library_node_harness_passes():
    script = WEB / "scripts" / "test-project-library-ui.mjs"
    res = subprocess.run(["node", str(script)], cwd=str(WEB), capture_output=True, text=True)
    assert res.returncode == 0, f"Harness failed:\n{res.stderr}\n{res.stdout}"
    assert "PASS: Lane A7 Project Library UI contract verified." in res.stdout


def test_project_library_schema_and_model_invariants():
    schema_path = REPO / "schemas" / "project_library.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    assert schema["properties"]["schema"]["const"] == "spe.project-library.v1"
    assert schema["properties"]["visibility"]["const"] == "private"
    assert schema["properties"]["noindex"]["const"] is True
    assert schema["properties"]["indexing"]["const"] == "noindex"
    assert schema["properties"]["spe_contract"]["const"] == "NOT_YET_BOUND"

    model_code = (WEB / "src" / "library" / "projectLibraryModel.ts").read_text(encoding="utf-8")
    assert 'schema: "spe.project-library.v1"' in model_code
    assert 'visibility: "private"' in model_code
    assert "noindex: true" in model_code
    assert 'indexing: "noindex"' in model_code
    assert 'spe_contract: "NOT_YET_BOUND"' in model_code
    assert 'ROUTE_MOUNT_STATUS = "NOT_INTEGRATED"' in model_code


def test_project_library_route_isolation():
    app_tsx = (WEB / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "ProjectLibraryView" not in app_tsx, "ProjectLibraryView must remain unmounted from App.tsx"
