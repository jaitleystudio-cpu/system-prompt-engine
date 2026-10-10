"""Isolated execution sandbox for untrusted or synthesized capability procedures."""

from __future__ import annotations

import ast
import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Set

from spe_runtime.capabilities.capsule import CapabilityCapsule, ProcedureFormat


class SandboxSecurityViolation(Exception):
    """Raised when an untrusted procedure attempts an unauthorized operation."""
    pass


@dataclass(frozen=True)
class ExecutionResult:
    success: bool
    output: Any
    latency_ms: float
    error: Optional[str] = None


SandboxExecutionResult = ExecutionResult


BLOCKED_MODULES: Set[str] = {
    "os", "sys", "subprocess", "socket", "http", "urllib", "requests", "shutil",
    "ctypes", "posix", "nt", "importlib", "pickle", "pathlib", "builtins"
}

BLOCKED_BUILTINS: Set[str] = {
    "__import__", "eval", "exec", "open", "compile", "globals", "locals",
    "input", "breakpoint", "help", "exit", "quit"
}


class ASTSecurityInspector(ast.NodeVisitor):
    """Static AST analyzer that verifies synthesized Python code against malicious calls."""

    def __init__(self) -> None:
        self.violations: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name.split(".")[0] in BLOCKED_MODULES:
                self.violations.append(f"Forbidden import: {alias.name}")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and node.module.split(".")[0] in BLOCKED_MODULES:
            self.violations.append(f"Forbidden import from: {node.module}")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_BUILTINS:
            self.violations.append(f"Forbidden builtin call: {node.func.id}")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr.startswith("__") and node.attr.endswith("__"):
            self.violations.append(f"Forbidden dunder attribute access: {node.attr}")
        self.generic_visit(node)


class CapabilitySandbox:
    """Executes capability procedures inside bounded, capability-restricted isolation."""

    @staticmethod
    def inspect_static_safety(code_str: str) -> None:
        """Statically inspect Python code using AST before compilation."""
        try:
            tree = ast.parse(code_str)
        except SyntaxError as e:
            raise SandboxSecurityViolation(f"Syntax error in synthesized procedure: {e}") from e

        inspector = ASTSecurityInspector()
        inspector.visit(tree)
        if inspector.violations:
            raise SandboxSecurityViolation(
                f"Security violations detected: {'; '.join(inspector.violations)}"
            )

    @classmethod
    def execute_capsule(
        cls,
        capsule: CapabilityCapsule,
        input_data: Dict[str, Any],
        max_duration_ms: float = 500.0,
    ) -> ExecutionResult:
        """Execute a procedure inside the isolated sandbox."""
        start_time = time.perf_counter()

        if capsule.procedure.format == ProcedureFormat.AST_JSON:
            try:
                if not isinstance(input_data, dict):
                    raise ValueError(f"Expected dict input, got {type(input_data).__name__}")
                rule = json.loads(capsule.procedure.payload)
                if not isinstance(rule, dict):
                    result = rule
                elif "target_key" in rule:
                    key = str(rule["target_key"])
                    result = {key: input_data.get(key, None), "transformed": True}
                elif "op" in rule:
                    op = str(rule["op"])
                    if op == "pick" and isinstance(rule.get("fields"), list):
                        result = {
                            f: input_data[f]
                            for f in rule["fields"]
                            if isinstance(f, str) and f in input_data
                        }
                    elif op == "merge" and isinstance(rule.get("static"), dict):
                        result = {**input_data, **rule["static"], "merged": True}
                    else:
                        result = {"input": input_data, "ast": rule, "executed": True}
                else:
                    result = {**rule, **input_data, "executed": True}

                elapsed = (time.perf_counter() - start_time) * 1000.0
                return ExecutionResult(success=True, output=result, latency_ms=elapsed)
            except Exception as e:
                elapsed = (time.perf_counter() - start_time) * 1000.0
                return ExecutionResult(success=False, output=None, latency_ms=elapsed, error=str(e))

        elif capsule.procedure.format == ProcedureFormat.PYTHON_SANDBOX:
            # 1. Static AST Inspection
            try:
                cls.inspect_static_safety(capsule.procedure.payload)
            except SandboxSecurityViolation as e:
                elapsed = (time.perf_counter() - start_time) * 1000.0
                return ExecutionResult(success=False, output=None, latency_ms=elapsed, error=str(e))

            # 2. Bounded Environment Construction
            safe_builtins = {
                k: v for k, v in __builtins__.items()
                if k not in BLOCKED_BUILTINS and not k.startswith("__")
            } if isinstance(__builtins__, dict) else {
                k: getattr(__builtins__, k) for k in dir(__builtins__)
                if k not in BLOCKED_BUILTINS and not k.startswith("__")
            }

            scope: Dict[str, Any] = {"__builtins__": safe_builtins}

            try:
                compiled = compile(capsule.procedure.payload, "<capability_sandbox>", "exec")
                exec(compiled, scope)

                entrypoint: Optional[Callable] = scope.get(capsule.procedure.entrypoint)
                if not entrypoint or not callable(entrypoint):
                    elapsed = (time.perf_counter() - start_time) * 1000.0
                    return ExecutionResult(
                        success=False,
                        output=None,
                        latency_ms=elapsed,
                        error=f"Entrypoint '{capsule.procedure.entrypoint}' not found or not callable",
                    )

                output = entrypoint(input_data)
                elapsed = (time.perf_counter() - start_time) * 1000.0

                if elapsed > max_duration_ms:
                    return ExecutionResult(
                        success=False,
                        output=None,
                        latency_ms=elapsed,
                        error=f"Execution exceeded budget ({elapsed:.1f}ms > {max_duration_ms}ms)",
                    )

                return ExecutionResult(success=True, output=output, latency_ms=elapsed)

            except Exception as e:
                elapsed = (time.perf_counter() - start_time) * 1000.0
                return ExecutionResult(success=False, output=None, latency_ms=elapsed, error=f"{type(e).__name__}: {e}")

        else:
            elapsed = (time.perf_counter() - start_time) * 1000.0
            return ExecutionResult(
                success=False,
                output=None,
                latency_ms=elapsed,
                error=f"Unsupported format: {capsule.procedure.format}",
            )
