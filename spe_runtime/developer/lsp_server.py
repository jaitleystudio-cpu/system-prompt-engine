"""Language Server Protocol (LSP) server implementation for SPE (spe-lsp)."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Diagnostic:
    code: str
    message: str
    severity: int  # 1: Error, 2: Warning, 3: Information, 4: Hint
    line: int
    start_char: int
    end_char: int
    evidence_class: str = "STATIC_ANALYSIS"
    quick_fix: dict[str, Any] | None = None


SECRET_PATTERNS = [
    (r"(?i)(sk-[a-zA-Z0-9]{20,})", "OpenAI API Key detected in prompt text"),
    (r"(?i)(ghp_[a-zA-Z0-9]{30,})", "GitHub Token detected in prompt text"),
    (r"(?i)(aws_access_key_id|aws_secret_access_key)\s*[:=]\s*[A-Z0-9]{16,}", "AWS Credentials detected in prompt text"),
]

PII_PATTERNS = [
    (r"\b\d{3}-\d{2}-\d{4}\b", "Potential SSN pattern detected"),
    (r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b", "Potential Credit Card number detected"),
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "Potential Email address detected"),
]

AUTHORITY_KEYWORDS = ["grant", "authorize", "sudo", "execute_system", "bypass", "unrestricted", "delete_all"]


class SpeLanguageServer:
    def __init__(self) -> None:
        self.documents: dict[str, str] = {}

    def open_document(self, uri: str, content: str) -> list[Diagnostic]:
        self.documents[uri] = content
        return self.compute_diagnostics(uri)

    def change_document(self, uri: str, content: str) -> list[Diagnostic]:
        self.documents[uri] = content
        return self.compute_diagnostics(uri)

    def compute_diagnostics(self, uri: str) -> list[Diagnostic]:
        text = self.documents.get(uri, "")
        diagnostics: list[Diagnostic] = []
        lines = text.splitlines()

        for line_no, line in enumerate(lines):
            # 1. Secret scanning
            for pat, msg in SECRET_PATTERNS:
                m = re.search(pat, line)
                if m:
                    diagnostics.append(Diagnostic(
                        code="POTENTIAL_SECRET_LEAK",
                        message=msg,
                        severity=1,
                        line=line_no,
                        start_char=m.start(),
                        end_char=m.end(),
                        evidence_class="STATIC_ANALYSIS",
                    ))

            # 2. PII scanning
            for pat, msg in PII_PATTERNS:
                m = re.search(pat, line)
                if m:
                    diagnostics.append(Diagnostic(
                        code="POTENTIAL_PII_LEAK",
                        message=msg,
                        severity=2,
                        line=line_no,
                        start_char=m.start(),
                        end_char=m.end(),
                        evidence_class="STATIC_ANALYSIS",
                    ))

            # 3. Ambiguous / Self-granted authority
            for kw in AUTHORITY_KEYWORDS:
                if kw in line.lower() and "never" not in line.lower() and "cannot" not in line.lower():
                    diagnostics.append(Diagnostic(
                        code="UNKNOWN_AMBIGUOUS_AUTHORITY",
                        message=f"Prompt claims capability '{kw}' without verified SPE capability grant.",
                        severity=2,
                        line=line_no,
                        start_char=0,
                        end_char=len(line),
                        evidence_class="STATIC_ANALYSIS",
                    ))

            # 4. Hard constraint contradiction check (Bounded Rule Consistency)
            if "must always" in line.lower() and "must never" in line.lower():
                diagnostics.append(Diagnostic(
                    code="HARD_CONSTRAINT_CONTRADICTION",
                    message="Contradictory modal obligations detected within the same instruction line.",
                    severity=1,
                    line=line_no,
                    start_char=0,
                    end_char=len(line),
                    evidence_class="BOUNDED_RULE_CONSISTENCY",
                ))

            # 5. Unsupported provider constructs
            if "{{" in line and "}}" in line and "<|im_start|>" in text:
                diagnostics.append(Diagnostic(
                    code="UNSUPPORTED_PROVIDER_CONSTRUCT",
                    message="Mixing Jinja templates with raw chat markup causes cross-provider degradation.",
                    severity=3,
                    line=line_no,
                    start_char=0,
                    end_char=len(line),
                ))

        # 6. Large context positional-risk hypothesis (clearly distinguished from attention)
        total_tokens_est = sum(len(l.split()) for l in lines) * 1.3
        if total_tokens_est > 3000:
            middle_line = len(lines) // 2
            diagnostics.append(Diagnostic(
                code="POSITIONAL_RISK_HEURISTIC",
                message=(
                    "POSITIONAL_RISK_HEURISTIC: High token volume detected. Instructions placed in the middle "
                    "40-60% span historically experience higher retrieval failure in lost-in-the-middle evaluations. "
                    "Note: This is a static positional hypothesis, NOT an observed attention measurement. "
                    "Run `spe bench --salience` for OBSERVED_RECALL_PROBE evidence."
                ),
                severity=3,
                line=middle_line,
                start_char=0,
                end_char=len(lines[middle_line]) if lines else 0,
                evidence_class="STATIC_ANALYSIS",
            ))

        return diagnostics

    def provide_hover(self, uri: str, line: int, char: int) -> dict[str, Any] | None:
        text = self.documents.get(uri, "")
        lines = text.splitlines()
        if line >= len(lines):
            return None
        target_line = lines[line]
        return {
            "contents": {
                "kind": "markdown",
                "value": (
                    f"**SPE Instruction Clause Analysis**\n\n"
                    f"- **Line**: {line + 1}\n"
                    f"- **Length**: {len(target_line)} chars\n"
                    f"- **Provenance**: Bound to canonical ProtectedIntent\n"
                    f"- **Evidence Status**: `STATIC_ANALYSIS`\n"
                    f"- **Causal Trace**: Run `spe explain` to view complete provenance lineage"
                ),
            }
        }


def run_lsp_server() -> None:
    """Standard IO entry point for Language Server Protocol."""
    import sys
    server = SpeLanguageServer()
    while True:
        header = sys.stdin.readline()
        if not header:
            break
        if header.startswith("Content-Length:"):
            length = int(header.split(":")[1].strip())
            sys.stdin.readline()  # empty line
            payload = json.loads(sys.stdin.read(length))
            method = payload.get("method")
            params = payload.get("params", {})

            response = None
            if method == "initialize":
                response = {
                    "capabilities": {
                        "textDocumentSync": 1,
                        "hoverProvider": True,
                    }
                }
            elif method == "textDocument/didOpen":
                doc = params.get("textDocument", {})
                server.open_document(doc.get("uri", ""), doc.get("text", ""))
            elif method == "textDocument/didChange":
                doc = params.get("textDocument", {})
                changes = params.get("contentChanges", [])
                if changes:
                    server.change_document(doc.get("uri", ""), changes[0].get("text", ""))

            if response is not None and "id" in payload:
                out = json.dumps({"jsonrpc": "2.0", "id": payload["id"], "result": response})
                sys.stdout.write(f"Content-Length: {len(out.encode('utf-8'))}\r\n\r\n{out}")
                sys.stdout.flush()
