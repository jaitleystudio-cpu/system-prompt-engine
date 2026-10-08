"""Semantic ISA to Behavioral Microcode Lowering Compiler.

Compiles model-independent Semantic ISA programs into optimal target-specific
behavioral microcode (Claude XML, OpenAI Markdown, Llama GBNF).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ModelTarget(str, Enum):
    CLAUDE_XML = "claude-xml"
    OPENAI_MARKDOWN = "openai-markdown"
    LLAMA_GBNF = "llama-gbnf"


@dataclass
class SemanticInstruction:
    opcode: str  # REQUIRE_AUTHORITY, INFER_RELATION, ASSERT_INVARIANT, PROPOSE_EFFECT
    operands: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CompiledMicrocode:
    target: ModelTarget
    system_text: str
    grammar_or_schema: Optional[Dict[str, Any]] = None
    instruction_count: int = 0


class SemanticMicrocodeCompiler:
    """Translates high-level Semantic ISA into target-specific microcode."""

    def compile(
        self,
        instructions: List[SemanticInstruction],
        target: ModelTarget = ModelTarget.CLAUDE_XML,
    ) -> CompiledMicrocode:
        """Lowers semantic instruction stream to target microcode."""
        if target == ModelTarget.CLAUDE_XML:
            return self._compile_claude_xml(instructions)
        elif target == ModelTarget.OPENAI_MARKDOWN:
            return self._compile_openai_markdown(instructions)
        elif target == ModelTarget.LLAMA_GBNF:
            return self._compile_llama_gbnf(instructions)
        else:
            raise ValueError(f"Unsupported model target: {target}")

    def _compile_claude_xml(self, instructions: List[SemanticInstruction]) -> CompiledMicrocode:
        lines = [
            "<semantic_machine version=\"1.0\">",
            "  <anti_hallucination_preamble>",
            "    You are a stateless Probabilistic Arithmetic Logic Unit (p-ALU).",
            "    Do not generate conversational filler. Adhere strictly to semantic registers.",
            "  </anti_hallucination_preamble>",
            "  <instruction_stream>",
        ]
        for idx, inst in enumerate(instructions):
            lines.append(f"    <op id=\"{idx+1:02d}\" code=\"{inst.opcode}\">")
            for k, v in inst.operands.items():
                lines.append(f"      <{k}>{v}</{k}>")
            lines.append("    </op>")
        lines.append("  </instruction_stream>")
        lines.append("</semantic_machine>")

        return CompiledMicrocode(
            target=ModelTarget.CLAUDE_XML,
            system_text="\n".join(lines),
            grammar_or_schema=None,
            instruction_count=len(instructions),
        )

    def _compile_openai_markdown(self, instructions: List[SemanticInstruction]) -> CompiledMicrocode:
        lines = [
            "# SPE Ω Semantic Machine Instructions",
            "You are executing as a stateless probabilistic kernel. Invariants are non-negotiable.",
            "",
            "## Program Operations",
        ]
        tools_schema = []
        for idx, inst in enumerate(instructions):
            lines.append(f"{idx+1}. **{inst.opcode}**")
            for k, v in inst.operands.items():
                lines.append(f"   - `{k}`: {v}")
            if inst.opcode == "PROPOSE_EFFECT":
                tools_schema.append({
                    "name": inst.operands.get("action", "unknown_action"),
                    "description": f"Target: {inst.operands.get('target', '*')}",
                })

        return CompiledMicrocode(
            target=ModelTarget.OPENAI_MARKDOWN,
            system_text="\n".join(lines),
            grammar_or_schema={"tools": tools_schema} if tools_schema else None,
            instruction_count=len(instructions),
        )

    def _compile_llama_gbnf(self, instructions: List[SemanticInstruction]) -> CompiledMicrocode:
        lines = [
            "; SPE Ω Context-Free Grammar for Llama Edge Kernel",
            "root ::= operation+",
            'ws ::= [ \\t\\n]*',
        ]
        op_types = set(inst.opcode for inst in instructions)
        if op_types:
            op_rules = " | ".join(f'"{op}"' for op in sorted(op_types))
            lines.append(f"operation ::= ({op_rules}) ws json_payload ws")
            lines.append('json_payload ::= "{" ws [^}]* ws "}"')

        return CompiledMicrocode(
            target=ModelTarget.LLAMA_GBNF,
            system_text="\n".join(lines),
            grammar_or_schema={"gbnf": "\n".join(lines)},
            instruction_count=len(instructions),
        )
