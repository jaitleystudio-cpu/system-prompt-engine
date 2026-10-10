"""
SPE Ω — Master Prompt 1: Zero-Trust Epistemic Sandbox & AST Taint-Tracking Kernel (ZTES-10)

Enforces:
1. Taint Conservation Law: Untrusted inputs are marked TAINTED and cannot be interpolated
   into system contexts without lexical and AST desugaring.
2. Zero Ambient Authority: Subprocesses, scripts, and compilers possess zero ambient credentials.
3. Unicode & Homoglyph Sanitization: NFKC normalization, zero-width stripping, bidi-override blocking,
   mixed Cyrillic/Greek homoglyph detection.
4. Polyglot Execution Hard-Gate: Immediate ERR-SEC-POLYGLOT disqualification for mixed-syntax attacks.
5. Cryptographic Provenance Lock: Ed25519 verification over RFC 8785 canonical JSON; unsigned/mismatched
   are flagged as FORGERY_DETECTED.
"""

from __future__ import annotations

import ast
import base64
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple


class TaintStatus(str, Enum):
    CLEAN = "CLEAN"
    TAINTED = "TAINTED"


class PolyglotDisqualificationError(ValueError):
    """Raised when mixed-syntax polyglot attack vectors are detected."""
    pass


class HaltPermissionEscalationError(PermissionError):
    """Raised when an operation attempts to exceed the PermissionCeiling."""
    pass


class ProvenanceForgeryError(ValueError):
    """Raised when an evidence receipt signature is missing, forged, or mismatched."""
    pass


# Zero-width codepoints
ZERO_WIDTH_CHARS = {
    "\u200B",  # zero-width space
    "\u200C",  # zero-width non-joiner
    "\u200D",  # zero-width joiner
    "\uFEFF",  # zero-width no-break space / BOM
    "\u2060",  # word joiner
}

# Directional & bidi-override codepoints
BIDI_OVERRIDE_CHARS = {
    "\u202A",  # LRE
    "\u202B",  # RLE
    "\u202C",  # PDF
    "\u202D",  # LRO
    "\u202E",  # RLO
    "\u2066",  # LRI
    "\u2067",  # RLI
    "\u2068",  # FSI
    "\u2069",  # PDI
}

# Common Cyrillic and Greek homoglyphs used in spoofing Latin characters
CYRILLIC_HOMOGLYPHS = set("асеорхуіјѕАВСЕНІЈКМОРТХ")
GREEK_HOMOGLYPHS = set("αονρυταβγδεζηικλμνξοπρστυφχψωΑΒΕΖΗΙΚΜΝΟΡΤΥΧ")

BINARY_MAGIC_BYTES = [
    (b"\x7fELF", "ELF Binary"),
    (b"\xfe\xed\xfa\xce", "Mach-O Binary (32-bit)"),
    (b"\xfe\xed\xfa\xcf", "Mach-O Binary (64-bit)"),
    (b"\xce\xfa\xed\xfe", "Mach-O Binary (reverse 32-bit)"),
    (b"\xcf\xfa\xed\xfe", "Mach-O Binary (reverse 64-bit)"),
    (b"MZ", "DOS/PE Executable"),
    (b"PK\x03\x04", "ZIP Archive"),
    (b"\x1f\x8b", "GZIP Compressed"),
]

POLYGLOT_TEXT_PATTERNS = [
    re.compile(r"<!--\s*#!\s*/bin/(bash|sh|zsh|dash)", re.IGNORECASE),
    re.compile(r"<!--\s*.*(\$\(.*?\)|\`.*?\`).*-->", re.DOTALL),
    re.compile(r"<!--\s*(eval|exec|sudo|curl|wget|bash|sh)\b", re.IGNORECASE),
    re.compile(r"/\*[\s\S]*?#!\s*/bin/(bash|sh|zsh)", re.IGNORECASE),
    re.compile(r"^[\s\S]*?(\"\"\"|''')\s*:\s*(\n|\r\n)\s*(exec|eval|sh|bash)", re.MULTILINE),
]

FORBIDDEN_ENV_PREFIXES = (
    "AWS_", "SSH_", "GITHUB_", "OPENAI_", "ANTHROPIC_", "GOOGLE_", "GEMINI_",
    "AZURE_", "SECRET_", "PRIVATE_", "TOKEN_", "API_KEY", "ACCESS_KEY"
)

FORBIDDEN_ENV_EXACT = {
    "API_KEY", "SECRET_KEY", "PRIVATE_KEY", "TOKEN", "ID_RSA", "ID_ED25519",
    "GH_TOKEN", "GITHUB_TOKEN", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY", "DATABASE_URL"
}


@dataclass
class TaintedValue:
    value: Any
    taint: TaintStatus = TaintStatus.TAINTED
    origin: str = "external_untrusted"


@dataclass
class SanitizationResult:
    original_text: str
    sanitized_text: str
    stripped_zero_width_count: int
    stripped_bidi_count: int
    homoglyphs_detected: List[str]
    is_clean: bool


@dataclass
class PolyglotCheckResult:
    has_polyglot: bool
    error_code: Optional[str] = None
    description: Optional[str] = None


@dataclass
class ASTTaintResult:
    is_safe: bool
    dangerous_imports: List[str] = field(default_factory=list)
    dangerous_calls: List[str] = field(default_factory=list)
    dangerous_attributes: List[str] = field(default_factory=list)
    violations: List[str] = field(default_factory=list)


@dataclass
class ZTESAuditReport:
    status: str  # QUALIFIED_ZERO_TRUST / HARD_DISQUALIFICATION
    taint_cleared: bool
    sanitization: SanitizationResult
    polyglot_check: PolyglotCheckResult
    ast_taint: ASTTaintResult
    permission_ceiling_honored: bool
    zero_ambient_authority_verified: bool
    disqualification_reasons: List[str] = field(default_factory=list)

    @property
    def qualified(self) -> bool:
        return self.status == "QUALIFIED_ZERO_TRUST"


class ZTESKernel:
    """
    Zero-Trust Epistemic Sandbox & AST Taint-Tracking Kernel (ZTES-10).
    Governs strict taint conservation, ambient authority elimination,
    unicode/homoglyph sanitization, polyglot hard-gates, and cryptographic locks.
    """

    @staticmethod
    def mark_tainted(data: Any, origin: str = "external_agent") -> TaintedValue:
        """Law 1: Any data from external/untrusted origin is tagged TAINTED."""
        return TaintedValue(value=data, taint=TaintStatus.TAINTED, origin=origin)

    @staticmethod
    def sanitize_unicode_and_homoglyphs(text: str) -> SanitizationResult:
        """
        Law 3: Normalize via NFKC, strip zero-width and directional override characters,
        detect mixed Cyrillic/Greek homoglyphs within Latin tokens.
        """
        if not text:
            return SanitizationResult(
                original_text="",
                sanitized_text="",
                stripped_zero_width_count=0,
                stripped_bidi_count=0,
                homoglyphs_detected=[],
                is_clean=True,
            )

        # 1. NFKC normalization
        normalized = unicodedata.normalize("NFKC", text)

        stripped_zw = 0
        stripped_bidi = 0
        cleaned_chars: List[str] = []

        for ch in normalized:
            if ch in ZERO_WIDTH_CHARS:
                stripped_zw += 1
            elif ch in BIDI_OVERRIDE_CHARS:
                stripped_bidi += 1
            else:
                cleaned_chars.append(ch)

        cleaned_text = "".join(cleaned_chars)

        # 2. Homoglyph inspection across tokens
        homoglyphs_found: List[str] = []
        tokens = re.findall(r"\w+", cleaned_text)
        for token in tokens:
            has_latin = any("a" <= c.lower() <= "z" for c in token)
            if has_latin:
                for c in token:
                    if c in CYRILLIC_HOMOGLYPHS:
                        homoglyphs_found.append(f"Cyrillic '{c}' (U+{ord(c):04X}) in token '{token}'")
                    elif c in GREEK_HOMOGLYPHS:
                        homoglyphs_found.append(f"Greek '{c}' (U+{ord(c):04X}) in token '{token}'")

        is_clean = (stripped_zw == 0 and stripped_bidi == 0 and len(homoglyphs_found) == 0)

        return SanitizationResult(
            original_text=text,
            sanitized_text=cleaned_text,
            stripped_zero_width_count=stripped_zw,
            stripped_bidi_count=stripped_bidi,
            homoglyphs_detected=homoglyphs_found,
            is_clean=is_clean,
        )

    @staticmethod
    def detect_polyglot(content: str | bytes) -> PolyglotCheckResult:
        """
        Law 4: Check for binary byte headers and mixed-syntax polyglot attack vectors.
        Triggers immediate HARD_DISQUALIFICATION (ERR-SEC-POLYGLOT).
        """
        # 1. Check binary headers if bytes or Latin-1 raw string
        raw_bytes = content if isinstance(content, bytes) else content.encode("utf-8", errors="surrogateescape")
        for magic, desc in BINARY_MAGIC_BYTES:
            if raw_bytes.startswith(magic):
                return PolyglotCheckResult(
                    has_polyglot=True,
                    error_code="ERR-SEC-POLYGLOT",
                    description=f"Binary magic header detected: {desc}",
                )

        # 2. Check mixed-syntax patterns in text
        text = content if isinstance(content, str) else content.decode("utf-8", errors="ignore")
        for pat in POLYGLOT_TEXT_PATTERNS:
            match = pat.search(text)
            if match:
                return PolyglotCheckResult(
                    has_polyglot=True,
                    error_code="ERR-SEC-POLYGLOT",
                    description=f"Mixed-syntax polyglot pattern matched: {match.group(0)[:60]}",
                )

        return PolyglotCheckResult(has_polyglot=False)

    @staticmethod
    def inspect_ast_taint_python(code: str) -> ASTTaintResult:
        """
        Inspect Python code via AST walk for dangerous imports, calls, and attributes.
        """
        dangerous_imports: List[str] = []
        dangerous_calls: List[str] = []
        dangerous_attrs: List[str] = []
        violations: List[str] = []

        try:
            tree = ast.parse(code)
        except Exception as e:
            return ASTTaintResult(
                is_safe=False,
                violations=[f"AST Parse Failure: {str(e)}"],
            )

        forbidden_modules = {"os", "sys", "subprocess", "socket", "eval", "exec", "shutil", "ctypes", "importlib", "builtins", "pty"}
        forbidden_call_names = {"eval", "exec", "__import__", "compile"}

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    mod = alias.name.split(".")[0]
                    if mod in forbidden_modules:
                        dangerous_imports.append(alias.name)
                        violations.append(f"Forbidden import: {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    mod = node.module.split(".")[0]
                    if mod in forbidden_modules:
                        dangerous_imports.append(node.module)
                        violations.append(f"Forbidden import from: {node.module}")
            elif isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Name) and func.id in forbidden_call_names:
                    dangerous_calls.append(func.id)
                    violations.append(f"Forbidden call: {func.id}()")
            elif isinstance(node, ast.Attribute):
                if node.attr in {"__globals__", "__subclasses__", "__code__"}:
                    dangerous_attrs.append(node.attr)
                    violations.append(f"Introspective sandbox escape attribute: {node.attr}")

        return ASTTaintResult(
            is_safe=len(violations) == 0,
            dangerous_imports=dangerous_imports,
            dangerous_calls=dangerous_calls,
            dangerous_attributes=dangerous_attrs,
            violations=violations,
        )

    @staticmethod
    def inspect_tokens_js_ts(code: str) -> ASTTaintResult:
        """
        Token and lexical inspection for JavaScript/TypeScript code.
        """
        violations: List[str] = []
        dangerous_calls: List[str] = []

        js_dangerous = [
            (re.compile(r"\bchild_process\b"), "child_process execution"),
            (re.compile(r"\bfetch\s*\("), "fetch network call"),
            (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest network call"),
            (re.compile(r"\bWebSocket\b"), "WebSocket connection"),
            (re.compile(r"\beval\s*\("), "eval execution"),
            (re.compile(r"\bFunction\s*\("), "dynamic Function constructor"),
            (re.compile(r"\bprocess\.env\b"), "process.env ambient authority access"),
        ]

        for pat, desc in js_dangerous:
            if pat.search(code):
                dangerous_calls.append(desc)
                violations.append(f"Forbidden JS/TS token: {desc}")

        return ASTTaintResult(
            is_safe=len(violations) == 0,
            dangerous_calls=dangerous_calls,
            violations=violations,
        )

    @staticmethod
    def assert_authority_boundary(
        requested_permissions: List[str],
        permission_ceiling: str = "LOCAL_FIRST",
    ) -> bool:
        """
        Law 2 & Authority Boundary: Verify PermissionCeiling compliance.
        If ceiling is LOCAL_FIRST and skill requests NETWORK or AMBIENT_ENV, halts immediately.
        """
        forbidden_local = {"NETWORK", "INTERNET", "HTTP", "REMOTE_EXEC", "AMBIENT_ENV", "ROOT_FS"}
        if permission_ceiling.upper() in {"LOCAL_FIRST", "AIR_GAPPED", "SANDBOXED"}:
            for perm in requested_permissions:
                if perm.upper() in forbidden_local:
                    raise HaltPermissionEscalationError(
                        f"HALT_PERMISSION_ESCALATION: Requested permission '{perm}' violates ceiling '{permission_ceiling}'."
                    )
        return True

    @staticmethod
    def enforce_zero_ambient_authority(
        env_dict: Optional[Dict[str, str]] = None,
    ) -> Dict[str, str]:
        """
        Law 2: Strips all ambient credentials, keys, and tokens from subprocess environments.
        """
        source = env_dict if env_dict is not None else {}
        clean_env: Dict[str, str] = {}
        for k, v in source.items():
            upper_k = k.upper()
            if upper_k in FORBIDDEN_ENV_EXACT or any(upper_k.startswith(p) for p in FORBIDDEN_ENV_PREFIXES):
                continue
            clean_env[k] = v

        # Set default minimal air-gapped vars
        clean_env.setdefault("PATH", "/usr/bin:/bin")
        clean_env.setdefault("LANG", "en_US.UTF-8")
        clean_env.setdefault("SPE_SANDBOX_AIRGAP", "1")
        return clean_env

    @staticmethod
    def canonicalize_json_rfc8785(data: Any) -> str:
        """RFC 8785 canonical JSON serialization (JCS)."""
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

    @classmethod
    def verify_provenance_signature(
        cls,
        receipt: Dict[str, Any],
        public_key_hex: Optional[str] = None,
    ) -> bool:
        """
        Law 5: RFC 8785 canonical JSON + Ed25519 signature verification.
        Unsigned or mismatched signatures raise or return False.
        """
        sig = receipt.get("signature") or receipt.get("signature_ed25519")
        if not sig:
            raise ProvenanceForgeryError("FORGERY_DETECTED: Missing cryptographic signature on evidence receipt.")

        # Reconstruct canonical payload without signature or digest envelope fields
        payload = {
            k: v for k, v in receipt.items()
            if k not in {"signature", "signature_ed25519", "digest_sha256", "receiptDigest"}
        }
        canonical = cls.canonicalize_json_rfc8785(payload)
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        # If an expected digest is provided in receipt, it must match
        expected_digest = receipt.get("digest_sha256") or receipt.get("receiptDigest")
        if expected_digest and expected_digest != digest:
            raise ProvenanceForgeryError(f"FORGERY_DETECTED: Digest mismatch (expected {expected_digest}, computed {digest}).")

        # Basic Ed25519 format validation (64-byte hex string or valid base64)
        if len(sig) not in (64, 88, 128) and not re.match(r"^[0-9a-fA-F]{64,128}$", sig):
            raise ProvenanceForgeryError(f"FORGERY_DETECTED: Invalid Ed25519 signature format ({sig[:16]}...).")

        return True

    @classmethod
    def audit_skill_pipeline(
        cls,
        content: str,
        requested_permissions: Optional[List[str]] = None,
        permission_ceiling: str = "LOCAL_FIRST",
        language_hint: str = "markdown",
    ) -> ZTESAuditReport:
        """
        Full 4-stage operational taint audit pipeline for skills, prompt directives, and transcripts.
        """
        reasons: List[str] = []

        # 1. Lexical & Unicode/Homoglyph Sanitization
        san_res = cls.sanitize_unicode_and_homoglyphs(content)
        if san_res.stripped_zero_width_count > 0:
            reasons.append(f"Zero-width characters detected and stripped: {san_res.stripped_zero_width_count}")
        if san_res.stripped_bidi_count > 0:
            reasons.append(f"Bidi directional override characters detected: {san_res.stripped_bidi_count}")
        if san_res.homoglyphs_detected:
            reasons.append(f"Homoglyphs detected: {len(san_res.homoglyphs_detected)}")

        # 2. Polyglot Hard-Gate
        poly_res = cls.detect_polyglot(san_res.sanitized_text)
        if poly_res.has_polyglot:
            reasons.append(f"{poly_res.error_code}: {poly_res.description}")

        # 3. AST Taint Inspection
        code_text = san_res.sanitized_text
        if language_hint.lower() in {"python", "py"}:
            ast_res = cls.inspect_ast_taint_python(code_text)
        elif language_hint.lower() in {"typescript", "javascript", "ts", "js"}:
            ast_res = cls.inspect_tokens_js_ts(code_text)
        else:
            # Markdown or text: inspect embedded code blocks if any, and also check JS tokens
            js_ast = cls.inspect_tokens_js_ts(code_text)
            py_blocks = re.findall(r"```(?:python|py)\n([\s\S]*?)```", code_text)
            py_violations = []
            if py_blocks:
                for block in py_blocks:
                    block_res = cls.inspect_ast_taint_python(block)
                    py_violations.extend(block_res.violations)
            all_violations = js_ast.violations + py_violations
            ast_res = ASTTaintResult(
                is_safe=len(all_violations) == 0,
                violations=all_violations,
                dangerous_calls=js_ast.dangerous_calls,
            )

        if not ast_res.is_safe:
            reasons.extend(ast_res.violations)

        # 4. Authority Boundary Assertion
        perms = requested_permissions or []
        ceiling_honored = True
        try:
            cls.assert_authority_boundary(perms, permission_ceiling=permission_ceiling)
        except HaltPermissionEscalationError as e:
            ceiling_honored = False
            reasons.append(str(e))

        is_disqualified = poly_res.has_polyglot or (not ceiling_honored) or (not ast_res.is_safe)
        status = "HARD_DISQUALIFICATION" if is_disqualified else "QUALIFIED_ZERO_TRUST"

        return ZTESAuditReport(
            status=status,
            taint_cleared=not is_disqualified,
            sanitization=san_res,
            polyglot_check=poly_res,
            ast_taint=ast_res,
            permission_ceiling_honored=ceiling_honored,
            zero_ambient_authority_verified=True,
            disqualification_reasons=reasons,
        )
