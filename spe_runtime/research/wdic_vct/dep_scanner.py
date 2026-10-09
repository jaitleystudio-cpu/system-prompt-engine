"""
Automated AST Dependency Scanner for SPE Ω.
Part of WDIC-VCT & Counterfactual Witness Continuation (CWC).

Scans Python (AST) and TypeScript/JavaScript (Regex) files in a repository,
constructs the forward/reverse dependency graphs, and computes the exact
transitive invalidation cone for modified files.
"""

import ast
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


class ASTDependencyScanner:
    """
    Constructs real repository dependency graphs across Python and TypeScript/JavaScript.
    Calculates transitive invalidation cones when files are modified.
    """

    # Matches ES module and CommonJS imports
    TS_JS_IMPORT_RE = re.compile(
        r"""(?:import\s+(?:(?:[\w*\s{},$]+from\s+)?['"]([^'"]+)['"])|require\(['"]([^'"]+)['"]\))""",
        re.MULTILINE,
    )

    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.forward_graph: Dict[str, Set[str]] = {}  # file -> imported files
        self.reverse_graph: Dict[str, Set[str]] = {}  # file -> dependent files

    def scan_repository(self, target_subdirs: Optional[List[str]] = None) -> Dict[str, List[str]]:
        """
        Scans all supported code files under root_dir (or specific subdirs).
        Returns forward dependency graph: {relative_file_path: [relative_dependencies]}.
        """
        self.forward_graph.clear()
        self.reverse_graph.clear()

        subdirs = target_subdirs or ["spe_runtime", "src", "apps", "tests"]
        search_roots = [
            (self.root_dir / sd) for sd in subdirs if (self.root_dir / sd).exists()
        ]
        if not search_roots:
            search_roots = [self.root_dir]

        all_files: List[Path] = []
        for s_root in search_roots:
            for root, _, files in os.walk(s_root):
                if any(ignored in root for ignored in [".git", "node_modules", ".venv", "__pycache__", "dist", "build"]):
                    continue
                for f in files:
                    ext = os.path.splitext(f)[1]
                    if ext in [".py", ".ts", ".tsx", ".js", ".jsx"]:
                        all_files.append(Path(root) / f)

        # Process each file
        for fpath in all_files:
            rel_path = self._rel_path(fpath)
            deps: Set[str] = set()

            if fpath.suffix == ".py":
                deps = self._scan_python_imports(fpath)
            elif fpath.suffix in [".ts", ".tsx", ".js", ".jsx"]:
                deps = self._scan_ts_js_imports(fpath)

            self.forward_graph[rel_path] = deps

            # Build reverse graph
            if rel_path not in self.reverse_graph:
                self.reverse_graph[rel_path] = set()
            for d in deps:
                if d not in self.reverse_graph:
                    self.reverse_graph[d] = set()
                self.reverse_graph[d].add(rel_path)

        return {k: sorted(v) for k, v in self.forward_graph.items()}

    def _rel_path(self, p: Path) -> str:
        try:
            return str(p.relative_to(self.root_dir))
        except ValueError:
            return str(p)

    def _scan_python_imports(self, fpath: Path) -> Set[str]:
        deps: Set[str] = set()
        try:
            content = fpath.read_text(encoding="utf-8")
            tree = ast.parse(content, filename=str(fpath))
        except Exception:
            return deps

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    resolved = self._resolve_python_module(alias.name)
                    if resolved:
                        deps.add(resolved)
            elif isinstance(node, ast.ImportFrom):
                mod_name = node.module or ""
                if node.level > 0:
                    # Relative import
                    resolved = self._resolve_python_relative(fpath, mod_name, node.level)
                else:
                    resolved = self._resolve_python_module(mod_name)
                if resolved:
                    deps.add(resolved)

        return deps

    def _resolve_python_module(self, mod_name: str) -> Optional[str]:
        parts = mod_name.split(".")
        # Try finding a directory or file in root_dir
        candidate_file = self.root_dir / ("/".join(parts) + ".py")
        if candidate_file.exists():
            return self._rel_path(candidate_file)
        candidate_init = self.root_dir / "/".join(parts) / "__init__.py"
        if candidate_init.exists():
            return self._rel_path(candidate_init)
        return None

    def _resolve_python_relative(self, fpath: Path, mod_name: str, level: int) -> Optional[str]:
        cur_dir = fpath.parent
        for _ in range(level - 1):
            cur_dir = cur_dir.parent

        if mod_name:
            target = cur_dir / ("/".join(mod_name.split(".")) + ".py")
            if target.exists():
                return self._rel_path(target)
            target_pkg = cur_dir / "/".join(mod_name.split(".")) / "__init__.py"
            if target_pkg.exists():
                return self._rel_path(target_pkg)
        else:
            target_init = cur_dir / "__init__.py"
            if target_init.exists():
                return self._rel_path(target_init)
        return None

    def _scan_ts_js_imports(self, fpath: Path) -> Set[str]:
        deps: Set[str] = set()
        try:
            content = fpath.read_text(encoding="utf-8")
        except Exception:
            return deps

        matches = self.TS_JS_IMPORT_RE.findall(content)
        for match in matches:
            import_path = match[0] if isinstance(match, tuple) and match[0] else (match[1] if isinstance(match, tuple) and len(match) > 1 else str(match))
            if not import_path or not import_path.startswith("."):
                continue  # External package or node_module

            cur_dir = fpath.parent
            base_target = cur_dir / import_path
            # Check extensions
            for ext in ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]:
                candidate = Path(str(base_target) + ext).resolve()
                if candidate.exists() and candidate.is_file():
                    deps.add(self._rel_path(candidate))
                    break

        return deps

    def compute_invalidation_cone(self, modified_files: List[str]) -> Set[str]:
        """
        Computes the transitive invalidation closure: all files directly or
        indirectly dependent on any modified file.
        """
        invalidation_cone: Set[str] = set()
        queue: List[str] = []

        for f in modified_files:
            rel = self._rel_path(self.root_dir / f) if not os.path.isabs(f) else self._rel_path(Path(f))
            invalidation_cone.add(rel)
            queue.append(rel)

        while queue:
            current = queue.pop(0)
            dependents = self.reverse_graph.get(current, set())
            for dep in dependents:
                if dep not in invalidation_cone:
                    invalidation_cone.add(dep)
                    queue.append(dep)

        return invalidation_cone
