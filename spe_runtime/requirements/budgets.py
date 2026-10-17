"""SPE Ω — Typed Budgets & Output Length Constraints (Python parity)"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Literal

BudgetUnit = Literal["words", "tokens", "characters", "sentences"]
BudgetMode = Literal["exact", "maximum", "minimum", "range", "approximate"]


@dataclass(frozen=True)
class SourceBudget:
    source_words: int
    source_bytes: int


@dataclass(frozen=True)
class PromptArtifactBudget:
    max_prompt_tokens: int | None = None
    max_prompt_bytes: int | None = None
    overflow_policy: Literal["REJECT", "TRUNCATE_CONTEXT", "CHUNK"] = "REJECT"


@dataclass(frozen=True)
class RequestedAnswerBudget:
    unit: BudgetUnit
    mode: BudgetMode
    target: int
    min: int | None = None
    max: int | None = None
    raw_expression: str = ""
    counting_contract: str = "WORD_COUNT_V1"

    def to_dict(self) -> dict[str, Any]:
        return {
            "unit": self.unit,
            "mode": self.mode,
            "target": self.target,
            "min": self.min,
            "max": self.max,
            "raw_expression": self.raw_expression,
            "counting_contract": self.counting_contract,
        }


@dataclass(frozen=True)
class SourceDocument:
    id: str
    raw_text: str
    sha256: str
    byte_length: int
    word_count: int

    @classmethod
    def from_text(cls, text: str, source_id: str = "src-user-1") -> SourceDocument:
        encoded = text.encode("utf-8")
        h = hashlib.sha256(encoded).hexdigest()
        tokens = re.findall(r"\S+", text)
        return cls(
            id=source_id,
            raw_text=text,
            sha256=h,
            byte_length=len(encoded),
            word_count=len(tokens),
        )


def normalize_unicode_digits(text: str) -> str:
    out = []
    for ch in text:
        if ch.isdigit():
            out.append(str(unicodedata.decimal(ch, ch)))
        else:
            out.append(ch)
    return "".join(out)


def parse_flexible_number(raw: str) -> float | None:
    cleaned = normalize_unicode_digits(raw.strip().replace(",", "").replace("_", ""))
    try:
        val = float(cleaned)
        return val
    except ValueError:
        return None


def parse_requested_answer_budget(expr: str) -> dict[str, Any]:
    if not expr or not expr.strip():
        return {"status": "NO_BUDGET", "raw_expression": expr}

    normalized = normalize_unicode_digits(expr.strip()).lower()

    # Unit
    unit: BudgetUnit = "words"
    if re.search(r"\b(tokens?|toks?)\b", normalized):
        unit = "tokens"
    elif re.search(r"\b(characters?|chars?)\b", normalized):
        unit = "characters"
    elif re.search(r"\b(sentences?)\b", normalized):
        unit = "sentences"
    elif re.search(r"\b(words?)\b", normalized):
        unit = "words"

    # Range
    range_match = re.search(
        r"(?:between\s+)?([0-9][0-9,_eE.]*)\s*(?:-|–|—|to|\band\b)\s*([0-9][0-9,_eE.]*)",
        normalized,
    )
    if range_match and any(sep in normalized for sep in ["between", "-", "–", "—", "to", "and"]):
        min_val = parse_flexible_number(range_match.group(1))
        max_val = parse_flexible_number(range_match.group(2))
        if min_val is None or max_val is None:
            return {"status": "INVALID", "error": f"Malformed numeric range in {expr}"}
        if min_val < 0 or max_val < 0:
            return {"status": "INVALID", "error": "Negative values forbidden in length budget"}
        if min_val > max_val:
            return {"status": "CONFLICT", "error": f"CONFLICT: Inverted length range [{min_val}, {max_val}]"}
        return {
            "status": "SUCCESS",
            "budget": RequestedAnswerBudget(
                unit=unit,
                mode="range",
                target=int(max_val),
                min=int(min_val),
                max=int(max_val),
                raw_expression=expr,
            ),
        }

    nums = re.findall(r"[-+]?[0-9][0-9,_eE.]*", normalized)
    if not nums:
        return {"status": "NO_BUDGET", "raw_expression": expr}

    val = parse_flexible_number(nums[0])
    if val is None:
        return {"status": "INVALID", "error": f"Cannot parse number in {expr}"}
    if val < 0:
        return {"status": "INVALID", "error": f"Negative length is invalid: {val}"}

    int_val = int(val)

    if re.search(r"\b(exactly|exact|precisely|strictly)\b", normalized) or normalized.startswith("="):
        mode: BudgetMode = "exact"
        return {
            "status": "SUCCESS",
            "budget": RequestedAnswerBudget(
                unit=unit, mode=mode, target=int_val, min=int_val, max=int_val, raw_expression=expr
            ),
        }
    if re.search(r"\b(no more than|at most|under|max|maximum|up to|<=|<)\b", normalized):
        mode = "maximum"
        return {
            "status": "SUCCESS",
            "budget": RequestedAnswerBudget(
                unit=unit, mode=mode, target=int_val, max=int_val, raw_expression=expr
            ),
        }
    if re.search(r"\b(at least|minimum|min|no less than|>=|>)\b", normalized):
        mode = "minimum"
        return {
            "status": "SUCCESS",
            "budget": RequestedAnswerBudget(
                unit=unit, mode=mode, target=int_val, min=int_val, raw_expression=expr
            ),
        }
    if re.search(r"\b(about|approx|approximately|around|~)\b", normalized):
        mode = "approximate"
        return {
            "status": "SUCCESS",
            "budget": RequestedAnswerBudget(
                unit=unit, mode=mode, target=int_val, raw_expression=expr
            ),
        }

    return {
        "status": "SUCCESS",
        "budget": RequestedAnswerBudget(
            unit=unit, mode="exact", target=int_val, min=int_val, max=int_val, raw_expression=expr
        ),
    }


def detect_budget_conflicts(statements: list[str]) -> dict[str, Any]:
    budgets: list[RequestedAnswerBudget] = []
    for stmt in statements:
        res = parse_requested_answer_budget(stmt)
        if res.get("status") == "CONFLICT":
            return {"has_conflict": True, "message": res.get("error", "CONFLICT"), "budgets": []}
        if res.get("status") == "SUCCESS":
            budgets.append(res["budget"])

    if len(budgets) <= 1:
        return {"has_conflict": False, "budgets": budgets}

    for i in range(len(budgets)):
        for j in range(i + 1, len(budgets)):
            b1, b2 = budgets[i], budgets[j]
            if b1.unit != b2.unit:
                continue
            if b1.mode == "exact" and b2.mode == "exact" and b1.target != b2.target:
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Conflicting exact length constraints: {b1.target} vs {b2.target} {b1.unit}",
                    "budgets": budgets,
                }
            if b1.mode == "exact" and b2.mode == "maximum" and b1.target > (b2.max or b2.target):
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Exact requirement of {b1.target} {b1.unit} exceeds maximum of {b2.max or b2.target} {b2.unit}",
                    "budgets": budgets,
                }
            if b2.mode == "exact" and b1.mode == "maximum" and b2.target > (b1.max or b1.target):
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Exact requirement of {b2.target} {b2.unit} exceeds maximum of {b1.max or b1.target} {b1.unit}",
                    "budgets": budgets,
                }
            if b1.mode == "exact" and b2.mode == "minimum" and b1.target < (b2.min or b2.target):
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Exact requirement of {b1.target} {b1.unit} is below minimum of {b2.min or b2.target} {b2.unit}",
                    "budgets": budgets,
                }
            if b2.mode == "exact" and b1.mode == "minimum" and b2.target < (b1.min or b1.target):
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Exact requirement of {b2.target} {b2.unit} is below minimum of {b1.min or b1.target} {b1.unit}",
                    "budgets": budgets,
                }
            min_val = b1.min or (b1.target if b1.mode == "minimum" else None)
            max_val = b2.max or (b2.target if b2.mode == "maximum" else None)
            if min_val is not None and max_val is not None and min_val > max_val:
                return {
                    "has_conflict": True,
                    "message": f"[CONFLICT] Minimum constraint ({min_val}) exceeds maximum constraint ({max_val}) {b1.unit}",
                    "budgets": budgets,
                }

    return {"has_conflict": False, "budgets": budgets}


def format_compiled_length_requirement(budget: RequestedAnswerBudget) -> str:
    target_str = f"{budget.target:,}"
    if budget.mode == "exact":
        return f"FINAL OUTPUT LENGTH: Exactly {target_str} {budget.unit} under the specified counting convention."
    if budget.mode == "maximum":
        return f"FINAL OUTPUT LENGTH: At most {target_str} {budget.unit} under the specified counting convention."
    if budget.mode == "minimum":
        return f"FINAL OUTPUT LENGTH: At least {target_str} {budget.unit} under the specified counting convention."
    if budget.mode == "range":
        min_str = f"{budget.min:,}" if budget.min is not None else target_str
        max_str = f"{budget.max:,}" if budget.max is not None else target_str
        return f"FINAL OUTPUT LENGTH: Between {min_str} and {max_str} {budget.unit} under the specified counting convention."
    if budget.mode == "approximate":
        return f"FINAL OUTPUT LENGTH: Approximately {target_str} {budget.unit} under the specified counting convention."
    return f"FINAL OUTPUT LENGTH: {target_str} {budget.unit} under the specified counting convention."
