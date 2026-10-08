"""Prompt ABI and multi-provider dialect lowering adapters."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolDefinitionABI:
    name: str
    description: str
    parameters_schema: dict[str, Any]
    required_capabilities: list[str] = field(default_factory=list)


@dataclass
class PromptABI:
    system_identity: str
    objectives: list[str]
    invariants: list[str]
    negative_constraints: list[str]
    output_schema: dict[str, Any] | None = None
    tools: list[ToolDefinitionABI] = field(default_factory=list)
    few_shot_examples: list[dict[str, str]] = field(default_factory=list)
    context_anchors: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class PromptDialectAdapter:
    """Base provider dialect adapter."""

    def lower(self, abi: PromptABI) -> dict[str, Any]:
        raise NotImplementedError


class OpenAIDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        system_chunks = [abi.system_identity, "\n## OBJECTIVES:"]
        for obj in abi.objectives:
            system_chunks.append(f"- {obj}")

        if abi.invariants or abi.negative_constraints:
            system_chunks.append("\n## HARD CONSTRAINTS & INVARIANTS:")
            for inv in abi.invariants:
                system_chunks.append(f"- ALWAYS: {inv}")
            for neg in abi.negative_constraints:
                system_chunks.append(f"- NEVER: {neg}")

        if abi.context_anchors:
            system_chunks.append("\n## CONTEXT:")
            for ctx in abi.context_anchors:
                system_chunks.append(f"- {ctx}")

        messages = [{"role": "system", "content": "\n".join(system_chunks)}]

        for ex in abi.few_shot_examples:
            messages.append({"role": "user", "content": ex.get("input", "")})
            messages.append({"role": "assistant", "content": ex.get("output", "")})

        tools_spec = []
        for t in abi.tools:
            tools_spec.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters_schema,
                },
            })

        result: dict[str, Any] = {
            "messages": messages,
            "target": "openai",
        }
        if tools_spec:
            result["tools"] = tools_spec
        if abi.output_schema:
            result["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "response_payload",
                    "schema": abi.output_schema,
                    "strict": True,
                },
            }
        return result


class AnthropicDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        xml_chunks = [
            f"<system_instructions>\n<identity>{abi.system_identity}</identity>",
            "<objectives>",
        ]
        for obj in abi.objectives:
            xml_chunks.append(f"  <objective>{obj}</objective>")
        xml_chunks.append("</objectives>")

        if abi.invariants or abi.negative_constraints:
            xml_chunks.append("<constraints>")
            for inv in abi.invariants:
                xml_chunks.append(f"  <invariant>{inv}</invariant>")
            for neg in abi.negative_constraints:
                xml_chunks.append(f"  <prohibition>{neg}</prohibition>")
            xml_chunks.append("</constraints>")

        if abi.few_shot_examples:
            xml_chunks.append("<examples>")
            for i, ex in enumerate(abi.few_shot_examples, 1):
                xml_chunks.append(f"  <example id=\"{i}\">\n    <input>{ex.get('input', '')}</input>\n    <output>{ex.get('output', '')}</output>\n  </example>")
            xml_chunks.append("</examples>")

        if abi.output_schema:
            xml_chunks.append(f"<output_format>\nRespond strictly with JSON adhering to schema:\n{json.dumps(abi.output_schema, indent=2)}\n</output_format>")

        xml_chunks.append("</system_instructions>")

        anthropic_tools = []
        for t in abi.tools:
            anthropic_tools.append({
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters_schema,
            })

        return {
            "system": "\n".join(xml_chunks),
            "tools": anthropic_tools,
            "target": "anthropic",
        }


class GeminiDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        instr_parts = [
            f"Role: {abi.system_identity}\n",
            "Core Directives:\n" + "\n".join(f"- {o}" for o in abi.objectives),
        ]
        if abi.negative_constraints:
            instr_parts.append("\nBoundaries & Safety:\n" + "\n".join(f"- DO NOT: {n}" for n in abi.negative_constraints))
        if abi.invariants:
            instr_parts.append("\nRequired Behavior:\n" + "\n".join(f"- MUST: {i}" for i in abi.invariants))

        gemini_tools = []
        for t in abi.tools:
            gemini_tools.append({
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters_schema,
            })

        res: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": "\n".join(instr_parts)}]},
            "tools": [{"function_declarations": gemini_tools}] if gemini_tools else [],
            "target": "gemini",
        }
        if abi.output_schema:
            res["generation_config"] = {
                "response_mime_type": "application/json",
                "response_schema": abi.output_schema,
            }
        return res


class LocalOpenWeightDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        # Formats to ChatML / Llama-3 format
        header = f"<|im_start|>system\n{abi.system_identity}\n"
        if abi.objectives:
            header += "Objectives:\n" + "\n".join(f"• {o}" for o in abi.objectives) + "\n"
        if abi.invariants or abi.negative_constraints:
            header += "Strict Guardrails:\n" + "\n".join(f"! {i}" for i in abi.invariants)
            header += "\n" + "\n".join(f"X {n}" for n in abi.negative_constraints) + "\n"
        header += "<|im_end|>\n"

        prompt = header
        for ex in abi.few_shot_examples:
            prompt += f"<|im_start|>user\n{ex.get('input', '')}<|im_end|>\n"
            prompt += f"<|im_start|>assistant\n{ex.get('output', '')}<|im_end|>\n"

        return {
            "chatml_prompt": prompt,
            "target": "local-open-weight",
        }


class CursorRulesDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        body = [
            f"# {abi.system_identity}",
            "",
            "## Objectives",
            *[f"- {o}" for o in abi.objectives],
            "",
            "## Rules & Constraints",
            *[f"- ALWAYS: {i}" for i in abi.invariants],
            *[f"- NEVER: {n}" for n in abi.negative_constraints],
        ]
        if abi.tools:
            body.extend(["", "## Available Capabilities", *[f"- `{t.name}`: {t.description}" for t in abi.tools]])
        return {
            "cursorrules_content": "\n".join(body),
            "target": "cursor-rules",
        }


class WindsurfRulesDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        body = [
            f"# {abi.system_identity}",
            "",
            "## Objectives & Guidelines",
            *[f"- {o}" for o in abi.objectives],
            "",
            "## Invariant Enforcement",
            *[f"- STRICT: {i}" for i in abi.invariants],
            *[f"- DISALLOWED: {n}" for n in abi.negative_constraints],
        ]
        if abi.tools:
            body.extend(["", "## Available Capabilities & Tools", *[f"- `{t.name}`: {t.description}" for t in abi.tools]])
        return {
            "windsurfrules_content": "\n".join(body),
            "target": "windsurf-rules",
        }


class GenericAgentDialectAdapter(PromptDialectAdapter):
    def lower(self, abi: PromptABI) -> dict[str, Any]:
        parts = [
            f"You are {abi.system_identity}",
            "",
            "Primary Objectives:",
            *[f"1. {o}" for o in abi.objectives],
            "",
            "Behavioral Constraints:",
            *[f"- MUST: {i}" for i in abi.invariants],
            *[f"- MUST NOT: {n}" for n in abi.negative_constraints],
        ]
        if abi.context_anchors:
            parts.extend(["", "Context Anchors:", *[f"- {c}" for c in abi.context_anchors]])
        return {
            "system_prompt": "\n".join(parts),
            "target": "generic-agent",
        }


ADAPTERS: dict[str, PromptDialectAdapter] = {
    "openai": OpenAIDialectAdapter(),
    "anthropic": AnthropicDialectAdapter(),
    "gemini": GeminiDialectAdapter(),
    "local": LocalOpenWeightDialectAdapter(),
    "cursor": CursorRulesDialectAdapter(),
    "windsurf": WindsurfRulesDialectAdapter(),
    "agent": GenericAgentDialectAdapter(),
}


def lower_abi_to_provider(abi: PromptABI, provider: str) -> dict[str, Any]:
    prov = provider.lower()
    adapter = ADAPTERS.get(prov)
    if not adapter:
        raise ValueError(f"Unknown target provider '{provider}'. Supported: {list(ADAPTERS.keys())}")
    return adapter.lower(abi)

