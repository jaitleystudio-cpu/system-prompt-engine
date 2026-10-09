"""
Tests for Automated AST Dependency Scanner and Physical Skill Installation.
Part of WDIC-VCT & Counterfactual Witness Continuation (CWC).
"""

import os
import tempfile
from pathlib import Path
import pytest

from spe_runtime.research.wdic_vct.dep_scanner import ASTDependencyScanner
from spe_runtime.research.wdic_vct.skill_autoinstaller import SkillAutoInstaller


def test_ast_python_import_scanning():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        pkg = root / "mypkg"
        pkg.mkdir()
        (pkg / "__init__.py").write_text("", encoding="utf-8")

        # module_b
        mod_b = pkg / "b.py"
        mod_b.write_text("def helper(): return 42\n", encoding="utf-8")

        # module_a imports module_b
        mod_a = pkg / "a.py"
        mod_a.write_text("from .b import helper\nimport sys\n", encoding="utf-8")

        scanner = ASTDependencyScanner(str(root))
        graph = scanner.scan_repository(target_subdirs=["mypkg"])

        assert "mypkg/a.py" in graph
        assert "mypkg/b.py" in graph["mypkg/a.py"]


def test_transitive_invalidation_cone():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        pkg = root / "src"
        pkg.mkdir()

        # Chain: c.py <- b.py <- a.py
        (pkg / "c.py").write_text("CONST = 100\n", encoding="utf-8")
        (pkg / "b.py").write_text("from .c import CONST\n", encoding="utf-8")
        (pkg / "a.py").write_text("from .b import CONST\n", encoding="utf-8")

        scanner = ASTDependencyScanner(str(root))
        scanner.scan_repository(target_subdirs=["src"])

        # Modifying c.py must transitively invalidate c.py, b.py, and a.py!
        cone = scanner.compute_invalidation_cone(["src/c.py"])

        assert "src/c.py" in cone
        assert "src/b.py" in cone
        assert "src/a.py" in cone


def test_ts_js_import_scanning():
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        src = root / "src"
        src.mkdir()

        (src / "types.ts").write_text("export type User = { id: string };\n", encoding="utf-8")
        (src / "service.ts").write_text("import { User } from './types';\nexport const u: User = { id: '1' };\n", encoding="utf-8")

        scanner = ASTDependencyScanner(str(root))
        graph = scanner.scan_repository(target_subdirs=["src"])

        assert "src/service.ts" in graph
        assert "src/types.ts" in graph["src/service.ts"]


def test_physical_skill_installation_to_disk():
    with tempfile.TemporaryDirectory() as tmpdir:
        installer = SkillAutoInstaller(local_installed_skills={"systematic-debugging"})
        target_dir = os.path.join(tmpdir, "skills")

        # Install clerk-auth physically to disk
        success, path = installer.install_skill_to_disk("clerk-auth", target_dir=target_dir)

        assert success is True
        assert os.path.exists(path)
        assert path.endswith("SKILL.md")

        content = Path(path).read_text(encoding="utf-8")
        assert "name: clerk-auth" in content
        assert "SPE_OMEGA_AUTONOMOUS_SKILL_AUTHORITY" in content
        assert "clerk-auth" in installer.installed_skills
