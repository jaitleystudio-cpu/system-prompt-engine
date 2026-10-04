"""Local media product session over the pinned whisper.cpp CLI.

This is not a second recognition engine. Inference is the pinned `whisper-cli`
and the Telugu ggml file named by media-pack/PACK_MANIFEST.json. When that
model file is absent, the session may fetch it from the manifest SOURCE
(model ingress only). When the CLI is absent, the session builds the pinned
whisper.cpp commit into the relative media-pack (static, no absolute rpath).
User audio is never uploaded. A bad hash, a bad size, a bad rpath, or the
wrong architecture fails closed. The session owns decode, cancellation,
silence truth, and explicit modes. It does not claim live transcription.
Product media v1 follows the mount ledger.
"""

from __future__ import annotations

import array
import hashlib
import json
import os
import platform
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import urllib.request
import wave
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator

HEX = frozenset("0123456789abcdef")
PINNED_CLI_SHA256 = "c52fa726b9ab0b8b7b1cd798ffa07b2feee8b5c754a27b05400298a4646d2c40"
PINNED_TE_MODEL_SHA256 = "47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e"
PINNED_CLI_BYTES = 4618232
# Source repository of SOURCE_PIN. Not a binary URL.
WHISPER_CPP_GIT = "https://github.com/ggml-org/whisper.cpp.git"
PINNED_TE_MODEL_BYTES = 190085487
PINNED_PACK_ID = "spe-local-te-small-q5_1"
PINNED_PACK_VERSION = "1"
SOURCE_PIN = "927cfce34f31707e17f2bff35c349632fb9e2c3a"
PACK_DIR_NAME = "media-pack"
PACK_MANIFEST_NAME = "PACK_MANIFEST.json"
PACK_CLI_REL = "whisper-cli"
PACK_MODEL_REL = "models/ggml-te-small.bin"
SANDBOX_PROFILE = "(version 1)(allow default)(deny network*)"
_NON_LOCAL = (
    "browser",
    "web-speech",
    "webspeech",
    "cloud",
    "remote",
    "openai",
    "azure",
    "google",
    "aws",
    "http://",
    "https://",
)
_BROWSER = ("browser", "web-speech", "webspeech")
_VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}
# Fail-closed asset layout inside this candidate (no sibling worktree, no absolute path):
#   media-pack/PACK_MANIFEST.json
#   media-pack/whisper-cli                 (built from SOURCE_PIN when absent)
#   media-pack/models/ggml-te-small.bin
_SEGMENT_RE = re.compile(
    r"\[(\d{2}):(\d{2}):(\d{2}\.\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2}\.\d{3})\]\s*(.*)"
)
_PROGRESS_RE = re.compile(r"progress\s*=\s*(-?\d+)")
TIMESTAMP_STATE = "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
ProgressHook = Callable[[dict[str, object]], None]


class IntegrityError(ValueError):
    """Model or binary hash is missing, empty, or not the pinned digest."""


class UnsupportedPath(RuntimeError):
    """Caller asked for a path this qualified local backend will not pretend to serve."""


class DecodeError(UnsupportedPath):
    """ffmpeg could not produce 16 kHz mono PCM from the selected file."""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(f"{code}:{detail}")
        self.code = code


class FalseLocalError(RuntimeError):
    """A browser or cloud provider was presented as local execution."""


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file_sha256(path: Path, expected: str) -> str:
    """On-demand integrity. An empty or short hash is never a pass."""
    token = expected if isinstance(expected, str) else ""
    if len(token) != 64 or any(char not in HEX for char in token.lower()):
        raise IntegrityError("EMPTY_OR_INVALID_HASH")
    got = _sha256_file(Path(path))
    if got != token.lower():
        raise IntegrityError(f"HASH_MISMATCH:{got}")
    return got


def local_claim(provider: str) -> str:
    """Return LOCAL_CPU only for the pinned CLI. Browser/cloud stay NOT_LOCAL."""
    name = str(provider).strip().lower().replace("_", "-")
    if any(marker in name for marker in _NON_LOCAL):
        return "NOT_LOCAL"
    if name in {"whisper-cli", "local-cpu", "pinned-whisper-cpp"}:
        return "LOCAL_CPU"
    return "UNSUPPORTED"


def resolve_media_mode(*, provider: str, assets_ready: bool, neural_session_ran: bool) -> str:
    """LOCAL_NEURAL only after the pinned CLI actually ran.

    Browser speech is BROWSER_SERVICE. Cloud and missing assets are UNAVAILABLE.
    Energy checks that never spawn whisper-cli are LOCAL_FALLBACK.
    Corrupt input is not resolved here; callers fail it closed as UNAVAILABLE.
    """
    name = str(provider).strip().lower().replace("_", "-")
    if any(marker in name for marker in _BROWSER):
        return "BROWSER_SERVICE"
    if any(marker in name for marker in ("cloud", "remote", "openai", "azure", "google", "aws", "http://", "https://")):
        return "UNAVAILABLE"
    if not assets_ready:
        return "UNAVAILABLE"
    if neural_session_ran and name in {"whisper-cli", "local-cpu", "pinned-whisper-cpp"}:
        return "LOCAL_NEURAL"
    return "LOCAL_FALLBACK"


def product_gates(
    *,
    local_file_transcription: str,
    raw_media_egress: int,
    browser_journey: str = "NOT_RUN",
) -> dict[str, object]:
    """Honest gates. File proof does not flip v1, live, UI mount, or device."""
    mounted = browser_journey == "PASS"
    return {
        "TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND": "PRESERVED",
        "LIVE_TRANSCRIPTION": "UNAVAILABLE",
        "PRODUCT_MEDIA_V1": "PASS" if mounted else "NOT_PASS",
        "UI_INTEGRATED": "YES" if mounted else "NO",
        "UI_MOUNTED": "YES" if mounted else "NO",
        "SHELL_MOUNT": "DONE" if mounted else "REQUIRED",
        "PHYSICAL_DEVICE": "WAITING_EXTERNAL",
        "RAW_MEDIA_EGRESS": raw_media_egress,
        "TIMESTAMPS": TIMESTAMP_STATE,
        "BROWSER_CLOUD_STT": "NOT_LOCAL",
        "LOCAL_FILE_TRANSCRIPTION": local_file_transcription,
        "BROWSER_JOURNEY": browser_journey,
    }


def _clock_ms(hours: str, minutes: str, seconds: str) -> int:
    return int(round((int(hours) * 3600 + int(minutes) * 60 + float(seconds)) * 1000))


def parse_segment_timestamps(stdout: str) -> list[dict[str, object]]:
    """Parse whisper-cli segment lines. Never invents word times."""
    segments: list[dict[str, object]] = []
    for match in _SEGMENT_RE.finditer(stdout or ""):
        start_ms = _clock_ms(match.group(1), match.group(2), match.group(3))
        end_ms = _clock_ms(match.group(4), match.group(5), match.group(6))
        text = match.group(7).strip()
        if end_ms <= start_ms:
            continue
        segments.append({"start_ms": start_ms, "end_ms": end_ms, "text": text})
    return segments


def segments_fit_duration(segments: list[dict[str, object]], duration_ms: int) -> bool:
    """A printed window that ignores the real duration is not a proven timestamp."""
    if not segments or duration_ms <= 0:
        return False
    end_ms = max(int(segment["end_ms"]) for segment in segments)
    slack = max(400, int(duration_ms * 0.25))
    return abs(end_ms - duration_ms) <= slack


def accepted_progress(stderr: str) -> tuple[int | None, str]:
    """Keep only 0..100. The pinned CLI has emitted 1421%, which is not progress."""
    values = [int(token) for token in _PROGRESS_RE.findall(stderr or "")]
    if not values:
        return None, "NOT_REPORTED"
    usable = [value for value in values if 0 <= value <= 100]
    if not usable:
        return None, "UNUSABLE_CALLBACK"
    return usable[-1], "MODEL_PERCENT"


def _no_audio_text(detail: str) -> bool:
    folded = detail.lower()
    return (
        "does not contain any stream" in folded
        or "matches no streams" in folded
        or "output file does not contain any stream" in folded
    )


@dataclass(frozen=True)
class QualifiedAssets:
    cli_path: Path
    cli_sha256: str
    model_path: Path
    model_sha256: str
    raw_download: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "cli_path": str(self.cli_path),
            "cli_sha256": self.cli_sha256,
            "model_path": str(self.model_path),
            "model_sha256": self.model_sha256,
            "raw_download": self.raw_download,
            "source_pin": SOURCE_PIN,
        }


def _first_verified(candidates: list[Path], expected: str) -> tuple[Path, str]:
    errors: list[str] = []
    for candidate in candidates:
        if not candidate.exists():
            errors.append(f"missing:{candidate}")
            continue
        try:
            got = verify_file_sha256(candidate, expected)
        except IntegrityError as exc:
            errors.append(f"{candidate}:{exc}")
            continue
        return candidate.resolve(), got
    raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:" + ";".join(errors))


def pack_root() -> Path:
    """Candidate-relative media pack. Resolved from this file, never from a sibling tree."""
    return Path(__file__).resolve().parents[2] / PACK_DIR_NAME


def _reject_unrelative(relative: str) -> None:
    if not isinstance(relative, str) or not relative:
        raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
    if relative.startswith(("/", "\\")) or ":" in relative:
        raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
    parts = Path(relative).parts
    if not parts or ".." in parts:
        raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")


def _member(root: Path, relative: str) -> Path:
    _reject_unrelative(relative)
    candidate = (root / relative).resolve()
    root_resolved = root.resolve()
    if candidate != root_resolved and root_resolved not in candidate.parents:
        raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
    return candidate


def _host_arch() -> str:
    machine = platform.machine().lower()
    if machine in {"arm64", "aarch64"}:
        return "arm64"
    if machine in {"x86_64", "amd64"}:
        return "x86_64"
    raise IntegrityError("UNSUPPORTED_ARCHITECTURE")


def _binary_arch(path: Path) -> str:
    """Mach-O 64-bit CPU id. Other formats are unsupported for this pack."""
    with path.open("rb") as handle:
        header = handle.read(8)
    if len(header) < 8:
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    magic = int.from_bytes(header[:4], "little")
    cpu = int.from_bytes(header[4:8], "little")
    if magic != 0xFEEDFACF:
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    if cpu == 0x0100000C:
        return "arm64"
    if cpu == 0x01000007:
        return "x86_64"
    raise IntegrityError("UNSUPPORTED_ARCHITECTURE")


def _model_magic_ok(path: Path) -> bool:
    with path.open("rb") as handle:
        return handle.read(4) == b"lmgg"


def _load_pack_manifest(root: Path) -> dict[str, object]:
    manifest_path = root / PACK_MANIFEST_NAME
    if not manifest_path.is_file():
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_MANIFEST")
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_MANIFEST") from exc
    if not isinstance(payload, dict):
        raise IntegrityError("WRONG_MODEL")
    required = (
        "MODEL_PACK_ID",
        "VERSION",
        "REAL_SHA256",
        "EXPECTED_BYTES",
        "LICENSE",
        "SOURCE",
        "RUNTIME_COMPATIBILITY",
        "LANGUAGE_SCOPE",
    )
    if any(key not in payload for key in required):
        raise IntegrityError("WRONG_MODEL")
    if payload["MODEL_PACK_ID"] != PINNED_PACK_ID or str(payload["VERSION"]) != PINNED_PACK_VERSION:
        raise IntegrityError("WRONG_MODEL")
    if payload["REAL_SHA256"] != PINNED_TE_MODEL_SHA256 or payload["EXPECTED_BYTES"] != PINNED_TE_MODEL_BYTES:
        raise IntegrityError("WRONG_MODEL")
    if payload["LANGUAGE_SCOPE"] != ["te"]:
        raise IntegrityError("WRONG_MODEL")
    if not isinstance(payload["LICENSE"], str) or not payload["LICENSE"].strip():
        raise IntegrityError("WRONG_MODEL")
    if not isinstance(payload["SOURCE"], str) or not payload["SOURCE"].strip():
        raise IntegrityError("WRONG_MODEL")
    runtime = payload["RUNTIME_COMPATIBILITY"]
    if not isinstance(runtime, dict):
        raise IntegrityError("WRONG_MODEL")
    for key in ("cli_relative_path", "model_relative_path", "architectures", "cli_sha256", "cli_bytes", "source_pin", "cli_source", "cli_license"):
        if key not in runtime:
            raise IntegrityError("WRONG_MODEL")
    if runtime["cli_relative_path"] != PACK_CLI_REL or runtime["model_relative_path"] != PACK_MODEL_REL:
        raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
    if runtime["cli_sha256"] != PINNED_CLI_SHA256 or runtime["cli_bytes"] != PINNED_CLI_BYTES:
        raise IntegrityError("WRONG_MODEL")
    if runtime["source_pin"] != SOURCE_PIN:
        raise IntegrityError("WRONG_MODEL")
    cli_source = runtime["cli_source"]
    if (
        not isinstance(cli_source, str)
        or SOURCE_PIN not in cli_source
        or "://" in cli_source
        or cli_source.startswith("/")
    ):
        raise IntegrityError("WRONG_MODEL")
    if runtime["cli_license"] != "MIT":
        raise IntegrityError("WRONG_MODEL")
    arches = runtime["architectures"]
    if not isinstance(arches, list) or not arches or any(not isinstance(item, str) for item in arches):
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    _reject_unrelative(str(runtime["cli_relative_path"]))
    _reject_unrelative(str(runtime["model_relative_path"]))
    return payload


def _verify_packed_file(path: Path, *, expected_sha: str, expected_bytes: int, kind: str, architectures: list[str]) -> str:
    label = "MISSING_BINARY" if kind == "cli" else "MISSING_MODEL"
    if not path.is_file():
        raise IntegrityError(f"PINNED_ASSET_NOT_ON_DISK:{label}")
    size = path.stat().st_size
    if kind == "model" and size < expected_bytes:
        raise IntegrityError("MODEL_LOAD_INTERRUPTED")
    if size != expected_bytes:
        raise IntegrityError("SIZE_MISMATCH")
    if kind == "model" and not _model_magic_ok(path):
        raise IntegrityError("WRONG_MODEL")
    if kind == "cli":
        arch = _binary_arch(path)
        if arch != _host_arch() or arch not in architectures:
            raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    try:
        return verify_file_sha256(path, expected_sha)
    except IntegrityError as exc:
        if str(exc).startswith("HASH_MISMATCH"):
            raise IntegrityError("HASH_MISMATCH") from exc
        raise


_ACQUIRE_LOCK = threading.Lock()


def _manifest_model_source(manifest: dict[str, object]) -> str:
    """HTTPS model URL already stored on the pack manifest. Not a CLI URL."""
    license_name = manifest.get("LICENSE")
    source = manifest.get("SOURCE")
    if not isinstance(license_name, str) or not license_name.strip():
        raise IntegrityError("WRONG_MODEL")
    if not isinstance(source, str) or not source.startswith("https://") or any(ch.isspace() for ch in source):
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_MODEL")
    return source


def _acquire_absent_model(model_path: Path, manifest: dict[str, object]) -> None:
    """Stream the pinned ggml file into the relative pack.

    Call only when the model file is absent. A file that is already present
    is never replaced, so a short or wrong-hash model stays fail-closed.
    The request body is the model download. User audio is not sent.
    """
    source = _manifest_model_source(manifest)
    expected_bytes = int(manifest["EXPECTED_BYTES"])
    expected_sha = str(manifest["REAL_SHA256"]).lower()
    if expected_bytes != PINNED_TE_MODEL_BYTES or expected_sha != PINNED_TE_MODEL_SHA256:
        raise IntegrityError("WRONG_MODEL")
    model_path.parent.mkdir(parents=True, exist_ok=True)
    partial = model_path.with_name(model_path.name + ".partial")
    partial.unlink(missing_ok=True)
    digest = hashlib.sha256()
    size = 0
    try:
        request = urllib.request.Request(
            source,
            headers={"User-Agent": "spe-product-media/1", "Accept": "application/octet-stream"},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as handle:
            final = str(response.geturl())
            if not final.startswith("https://"):
                raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_MODEL")
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                size += len(chunk)
                if size > expected_bytes:
                    raise IntegrityError("SIZE_MISMATCH")
                digest.update(chunk)
                handle.write(chunk)
        if size != expected_bytes:
            raise IntegrityError("MODEL_LOAD_INTERRUPTED")
        got = digest.hexdigest()
        if got != expected_sha:
            raise IntegrityError("HASH_MISMATCH")
        if not _model_magic_ok(partial):
            raise IntegrityError("WRONG_MODEL")
        os.replace(partial, model_path)
        print(f"MEDIA_MODEL_INGRESS bytes={size} sha256={got}", file=sys.stderr, flush=True)
    except IntegrityError:
        partial.unlink(missing_ok=True)
        raise
    except Exception as exc:
        partial.unlink(missing_ok=True)
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_MODEL") from exc



def _tool(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise IntegrityError(f"PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_TOOL_ABSENT:{name}")
    return found


def _run_build(args: list[str], *, env: dict[str, str], timeout: int) -> None:
    try:
        proc = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED") from exc
    if proc.returncode != 0:
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED")


def _rpath_allowed(value: str) -> bool:
    if not value or value.startswith("/") or ".." in Path(value).parts:
        return False
    return value.startswith("@loader_path") or value.startswith("$ORIGIN")


def _dylib_allowed(value: str) -> bool:
    return value.startswith("/usr/lib/") or value.startswith("/System/Library/")


def _reject_external_linkage(path: Path) -> None:
    """Static product CLI: system libraries only, no absolute sibling rpath."""
    data = path.read_bytes()
    if len(data) < 32 or int.from_bytes(data[:4], "little") != 0xFEEDFACF:
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    ncmds = int.from_bytes(data[16:20], "little")
    offset = 32
    for _ in range(ncmds):
        if offset + 8 > len(data):
            raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
        cmd = int.from_bytes(data[offset : offset + 4], "little")
        cmdsize = int.from_bytes(data[offset + 4 : offset + 8], "little")
        if cmdsize < 8 or offset + cmdsize > len(data):
            raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
        if cmd == 0x8000001C:
            path_off = int.from_bytes(data[offset + 8 : offset + 12], "little")
            if path_off < 8 or offset + path_off >= offset + cmdsize:
                raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
            raw = data[offset + path_off : offset + cmdsize].split(b"\x00", 1)[0].decode("utf-8", "replace")
            if not _rpath_allowed(raw):
                raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
        if cmd in {0xC, 0x80000018}:
            name_off = int.from_bytes(data[offset + 8 : offset + 12], "little")
            if name_off < 8 or offset + name_off >= offset + cmdsize:
                raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
            raw = data[offset + name_off : offset + cmdsize].split(b"\x00", 1)[0].decode("utf-8", "replace")
            if not _dylib_allowed(raw):
                raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
        offset += cmdsize


def _pinned_source(src: Path, pin: str, git: str, env: dict[str, str]) -> None:
    def head() -> str:
        proc = subprocess.run(
            [git, "-C", str(src), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            env=env,
        )
        if proc.returncode != 0:
            return ""
        return proc.stdout.strip()

    if not (src / ".git").is_dir() or head() != pin:
        if src.exists():
            shutil.rmtree(src)
        src.parent.mkdir(parents=True, exist_ok=True)
        _run_build(
            [git, "clone", "--filter=blob:none", "--no-checkout", WHISPER_CPP_GIT, str(src)],
            env=env,
            timeout=300,
        )
        _run_build([git, "-C", str(src), "fetch", "--depth", "1", "origin", pin], env=env, timeout=300)
        _run_build([git, "-C", str(src), "checkout", "--detach", pin], env=env, timeout=180)
    if head() != pin:
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:SOURCE_PIN_MISMATCH")


def _acquire_absent_cli(cli_path: Path, manifest: dict[str, object]) -> None:
    """Build whisper-cli from the pinned whisper.cpp commit into the relative pack.

    Call only when the CLI file is absent. A file that is already present is
    never replaced, so a wrong-hash binary stays fail-closed. The build is
    static (CMAKE_SKIP_RPATH) and is rejected if any load command points
    outside system libraries or uses an absolute rpath. User audio is not sent.
    """
    runtime = manifest["RUNTIME_COMPATIBILITY"]
    assert isinstance(runtime, dict)
    pin = str(runtime["source_pin"])
    if pin != SOURCE_PIN or pin not in str(runtime["cli_source"]) or "://" in str(runtime["cli_source"]):
        raise IntegrityError("WRONG_MODEL")
    if runtime.get("cli_license") != "MIT":
        raise IntegrityError("WRONG_MODEL")
    git = _tool("git")
    cmake = _tool("cmake")
    clang = _tool("clang")
    clangxx = _tool("clang++")
    root = cli_path.parent
    work = root / ".whisper-build"
    src = work / "src"
    build = work / "cmake"
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["ZERO_AR_DATE"] = "1"
    env["SOURCE_DATE_EPOCH"] = "0"
    _pinned_source(src, pin, git, env)
    if build.exists():
        shutil.rmtree(build)
    prefix = f"-O3 -DNDEBUG -fdebug-prefix-map={src}=/whisper.cpp -ffile-prefix-map={src}=/whisper.cpp -g0"
    arch = _host_arch()
    _run_build(
        [
            cmake,
            "-S",
            str(src),
            "-B",
            str(build),
            "-DCMAKE_BUILD_TYPE=Release",
            "-DBUILD_SHARED_LIBS=OFF",
            "-DWHISPER_BUILD_TESTS=OFF",
            "-DWHISPER_BUILD_EXAMPLES=ON",
            "-DWHISPER_BUILD_SERVER=OFF",
            "-DWHISPER_COMMON_FFMPEG=OFF",
            "-DWHISPER_FFMPEG=OFF",
            "-DWHISPER_SDL2=OFF",
            "-DWHISPER_CURL=OFF",
            f"-DWHISPER_BUILD_COMMIT={pin}",
            "-DWHISPER_BUILD_NUMBER=0",
            "-DCMAKE_SKIP_RPATH=ON",
            f"-DCMAKE_C_COMPILER={clang}",
            f"-DCMAKE_CXX_COMPILER={clangxx}",
            f"-DCMAKE_C_FLAGS_RELEASE={prefix}",
            f"-DCMAKE_CXX_FLAGS_RELEASE={prefix}",
            f"-DCMAKE_OSX_ARCHITECTURES={arch}",
            "-DGGML_NATIVE=ON",
            "-DGGML_METAL=ON",
            "-DGGML_CCACHE=OFF",
        ],
        env=env,
        timeout=180,
    )
    _run_build(
        [cmake, "--build", str(build), "--target", "whisper-cli", "-j", str(os.cpu_count() or 2)],
        env=env,
        timeout=600,
    )
    built = build / "bin" / "whisper-cli"
    if not built.is_file():
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED")
    _reject_external_linkage(built)
    raw = built.read_bytes()
    if len(raw) != PINNED_CLI_BYTES:
        raise IntegrityError("SIZE_MISMATCH")
    got = hashlib.sha256(raw).hexdigest()
    if got != PINNED_CLI_SHA256:
        raise IntegrityError("HASH_MISMATCH")
    partial = cli_path.with_name(cli_path.name + ".partial")
    partial.unlink(missing_ok=True)
    try:
        partial.write_bytes(raw)
        os.chmod(partial, 0o755)
        os.replace(partial, cli_path)
    except OSError as exc:
        partial.unlink(missing_ok=True)
        raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_BINARY:BUILD_FAILED") from exc
    print(f"MEDIA_CLI_BUILD bytes={len(raw)} sha256={got} commit={pin}", file=sys.stderr, flush=True)


def discover_qualified_assets() -> QualifiedAssets:
    """Resolve the pinned CLI and Telugu model from the relative media-pack.

    The ggml file is fetched from the manifest SOURCE only when it is absent.
    The CLI is built from the pinned whisper.cpp commit only when it is absent.
    The manifest has no binary URL. Never reads a sibling-worktree path. A
    short model, a hash or size mismatch, a bad rpath, the wrong ggml file,
    or an unsupported architecture raises IntegrityError.
    """
    with _ACQUIRE_LOCK:
        root = pack_root()
        if not root.is_dir():
            raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:MISSING_PACK")
        manifest = _load_pack_manifest(root)
        runtime = manifest["RUNTIME_COMPATIBILITY"]
        assert isinstance(runtime, dict)
        architectures = [str(item) for item in runtime["architectures"]]
        if _host_arch() not in architectures:
            raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
        cli_path = _member(root, PACK_CLI_REL)
        model_path = _member(root, PACK_MODEL_REL)
        downloaded = False
        if not model_path.is_file():
            _acquire_absent_model(model_path, manifest)
            downloaded = True
        model_sha = _verify_packed_file(
            model_path,
            expected_sha=PINNED_TE_MODEL_SHA256,
            expected_bytes=PINNED_TE_MODEL_BYTES,
            kind="model",
            architectures=architectures,
        )
        if not cli_path.is_file():
            _acquire_absent_cli(cli_path, manifest)
        cli_sha = _verify_packed_file(
            cli_path,
            expected_sha=PINNED_CLI_SHA256,
            expected_bytes=PINNED_CLI_BYTES,
            kind="cli",
            architectures=architectures,
        )
        return QualifiedAssets(
            cli_path=cli_path,
            cli_sha256=cli_sha,
            model_path=model_path,
            model_sha256=model_sha,
            raw_download=downloaded,
        )


@dataclass(frozen=True)
class LocalTranscript:
    status: str
    text: str
    execution: str
    egress_attempts: int
    sandbox_network: str
    timestamp_state: str
    raw_audio_retained: bool
    audio_sha256: str
    media_kind: str
    pcm_released: bool
    no_speech_basis: str | None = None
    user_transcript_promoted: bool = False
    discarded_model_text: str | None = None
    duration_ms: int = 0
    mode: str = "UNAVAILABLE"
    error_code: str | None = None
    neural_session_ran: bool = False
    timestamps_proven: bool = False
    segments: tuple[dict[str, object], ...] = ()
    progress_percent: int | None = None
    progress_state: str = "NOT_REPORTED"
    attempts: int = 1
    phase: str = "done"

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "text": self.text,
            "execution": self.execution,
            "egress_attempts": self.egress_attempts,
            "sandbox_network": self.sandbox_network,
            "timestamp_state": self.timestamp_state,
            "raw_audio_retained": self.raw_audio_retained,
            "audio_sha256": self.audio_sha256,
            "media_kind": self.media_kind,
            "pcm_released": self.pcm_released,
            "no_speech_basis": self.no_speech_basis,
            "user_transcript_promoted": self.user_transcript_promoted,
            "discarded_model_text": self.discarded_model_text,
            "duration_ms": self.duration_ms,
            "mode": self.mode,
            "error_code": self.error_code,
            "neural_session_ran": self.neural_session_ran,
            "timestamps_proven": self.timestamps_proven,
            "segments": list(self.segments),
            "progress_percent": self.progress_percent,
            "progress_state": self.progress_state,
            "attempts": self.attempts,
            "phase": self.phase,
        }


def _wav_usable(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as handle:
            return handle.getnchannels() == 1 and handle.getsampwidth() == 2 and handle.getframerate() == 16000
    except wave.Error:
        return False


def _wav_duration_ms(path: Path) -> int:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate() or 1
        return int(handle.getnframes() * 1000 / rate)


def _ffmpeg() -> str:
    for candidate in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"):
        if candidate == "ffmpeg":
            return candidate
        if Path(candidate).exists():
            return candidate
    return "ffmpeg"


def _run_ffmpeg(args: list[str]) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise UnsupportedPath(
            "VIDEO_AUDIO_EXTRACT_FAILED:" + (completed.stderr or "")[-800:]
        )


@contextmanager
def trace_raw_media_egress() -> Iterator[list[dict[str, object]]]:
    """Record socket attempts. Does not open a route of its own."""
    attempts: list[dict[str, object]] = []
    real_connect = socket.socket.connect
    real_create = socket.create_connection

    def connect(self: socket.socket, address: object) -> object:
        host = address[0] if isinstance(address, tuple) and address else str(address)
        port = address[1] if isinstance(address, tuple) and len(address) > 1 else None
        attempts.append({"kind": "socket.connect", "host": str(host), "port": port})
        return real_connect(self, address)  # type: ignore[arg-type]

    def create_connection(address: object, *args: object, **kwargs: object) -> socket.socket:
        host = address[0] if isinstance(address, tuple) and address else str(address)
        port = address[1] if isinstance(address, tuple) and len(address) > 1 else None
        attempts.append({"kind": "socket.create_connection", "host": str(host), "port": port})
        return real_create(address, *args, **kwargs)  # type: ignore[arg-type]

    socket.socket.connect = connect  # type: ignore[method-assign]
    socket.create_connection = create_connection  # type: ignore[assignment]
    try:
        yield attempts
    finally:
        socket.socket.connect = real_connect  # type: ignore[method-assign]
        socket.create_connection = real_create  # type: ignore[assignment]


def sandbox_blocks_network(url: str = "https://example.com") -> dict[str, object]:
    """Proof that the same sandbox profile used for whisper denies a network client."""
    if not url.startswith("https://"):
        raise FalseLocalError("offline probe must be an https URL, not a raw-media upload")
    completed = subprocess.run(
        [
            "/usr/bin/sandbox-exec",
            "-p",
            SANDBOX_PROFILE,
            "/usr/bin/curl",
            "-I",
            "--max-time",
            "4",
            url,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return {
        "returncode": int(completed.returncode),
        "denied": completed.returncode != 0,
        "url_host": "example.com",
    }


@dataclass
class LocalMediaSession:
    """One local CPU session. Raw samples are dropped on close. Network is denied."""

    assets: QualifiedAssets
    language: str
    on_progress: ProgressHook | None = None
    _cancel_event: threading.Event = field(default_factory=threading.Event, init=False, repr=False)
    _proc: subprocess.Popen[str] | None = field(default=None, init=False, repr=False)
    _temps: list[Path] = field(default_factory=list, init=False, repr=False)
    _buffers: list[bytearray] = field(default_factory=list, init=False, repr=False)
    closed: bool = field(default=False, init=False)
    _pcm_released: bool = field(default=False, init=False)
    _attempts: int = field(default=0, init=False)
    phase: str = field(default="idle", init=False)
    egress_attempts: int = field(default=0, init=False)

    def __post_init__(self) -> None:
        if local_claim("whisper-cli") != "LOCAL_CPU":
            raise FalseLocalError("pinned CLI must stay local")
        if self.language != "te":
            raise UnsupportedPath("AUTO_OR_OTHER_NOT_PRODUCT_PATH")
        verify_file_sha256(self.assets.cli_path, self.assets.cli_sha256)
        verify_file_sha256(self.assets.model_path, self.assets.model_sha256)

    @classmethod
    def open(
        cls,
        assets: QualifiedAssets,
        *,
        language: str = "te",
        on_progress: ProgressHook | None = None,
    ) -> LocalMediaSession:
        return cls(assets, language, on_progress)

    @property
    def raw_bytes_held(self) -> int:
        return sum(len(buf) for buf in self._buffers)

    @property
    def temp_files_remaining(self) -> int:
        return sum(1 for path in self._temps if path.exists())

    def timestamp_support(self) -> dict[str, str]:
        """Qualified Telugu decode uses -nt. Do not invent word times."""
        return {
            "state": TIMESTAMP_STATE,
            "reason": "ggml-te-small product path requires whisper-cli -nt",
        }

    def cancel(self) -> None:
        self._cancel_event.set()
        self._emit("cancelled", None, "Cancel requested.")
        proc = self._proc
        if proc is not None and proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                return

    def close(self) -> None:
        self.cancel()
        for buf in self._buffers:
            buf.clear()
        self._buffers.clear()
        for path in self._temps:
            path.unlink(missing_ok=True)
        self._pcm_released = True
        self.closed = True
        self.phase = "closed"

    def extract_video_audio(self, audio_wav: Path, dest_mp4: Path) -> dict[str, Path]:
        """Mux a local video container around already-decoded audio. No download."""
        dest_mp4.parent.mkdir(parents=True, exist_ok=True)
        _run_ffmpeg(
            [
                _ffmpeg(),
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=160x120:d=3",
                "-i",
                str(audio_wav),
                "-shortest",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                str(dest_mp4),
            ]
        )
        return {"video_path": dest_mp4}

    def retry(self, path: Path, *, language: str | None = None) -> LocalTranscript:
        """Run the same local file again. Does not upload it."""
        return self.transcribe_path(path, language=language)

    def transcribe_path(self, path: Path, *, language: str | None = None) -> LocalTranscript:
        if self.closed:
            raise UnsupportedPath("SESSION_CLOSED")
        lang = self.language if language is None else language
        if lang != "te":
            raise UnsupportedPath("AUTO_OR_OTHER_NOT_PRODUCT_PATH")
        self._attempts += 1
        source = Path(path)
        media_kind = "video-audio" if source.suffix.lower() in _VIDEO_SUFFIXES else "audio"
        if not source.is_file():
            return self._error("CORRUPT", "FILE_MISSING", media_kind, "", 0, neural=False)
        self._emit("decoding", None, "Extracting audio on this device.")
        try:
            wav_path, duration_ms = self._to_wav(source, media_kind)
        except DecodeError as exc:
            kind = "video" if media_kind == "video-audio" else media_kind
            return self._error(exc.code, str(exc)[-240:], kind, self._sha(source), 0, neural=False)
        audio_sha = self._sha(source)
        peak = self._peak_abs(wav_path)
        if peak <= 8:
            self._release_pcm()
            self.phase = "done"
            return LocalTranscript(
                status="NO_SPEECH",
                text="",
                execution="LOCAL_CPU",
                egress_attempts=self.egress_attempts,
                sandbox_network="DENY",
                timestamp_state=TIMESTAMP_STATE,
                raw_audio_retained=False,
                audio_sha256=audio_sha,
                media_kind=media_kind,
                pcm_released=True,
                no_speech_basis="PCM_ENERGY",
                user_transcript_promoted=False,
                discarded_model_text=None,
                duration_ms=duration_ms,
                mode="LOCAL_FALLBACK",
                neural_session_ran=False,
                timestamps_proven=False,
                attempts=self._attempts,
                phase="done",
                progress_state="NOT_REPORTED",
            )
        if self._cancel_event.is_set():
            self._release_pcm()
            return self._cancelled(audio_sha, media_kind, duration_ms, neural=False)
        self._emit("transcribing", None, "Local neural session running.")
        stdout, stderr, returncode, spawned = self._infer(wav_path)
        progress, progress_state = accepted_progress(stderr)
        self._release_pcm()
        if self._cancel_event.is_set() or returncode < 0:
            cancelled = self._cancelled(audio_sha, media_kind, duration_ms, neural=spawned)
            return self._with_progress(cancelled, progress, progress_state)
        if returncode != 0:
            return self._error(
                "INFERENCE_FAILED",
                f"returncode={returncode}",
                media_kind,
                audio_sha,
                duration_ms,
                neural=spawned,
                progress=progress,
                progress_state=progress_state,
            )
        text = self._transcript_text(stdout)
        if not text:
            return LocalTranscript(
                status="NO_SPEECH",
                text="",
                execution="LOCAL_CPU",
                egress_attempts=self.egress_attempts,
                sandbox_network="DENY",
                timestamp_state=TIMESTAMP_STATE,
                raw_audio_retained=False,
                audio_sha256=audio_sha,
                media_kind=media_kind,
                pcm_released=True,
                no_speech_basis="EMPTY_MODEL_TEXT",
                user_transcript_promoted=False,
                duration_ms=duration_ms,
                mode=resolve_media_mode(provider="whisper-cli", assets_ready=True, neural_session_ran=True),
                neural_session_ran=True,
                timestamps_proven=False,
                attempts=self._attempts,
                phase="done",
                progress_percent=progress,
                progress_state=progress_state,
            )
        self.phase = "done"
        return LocalTranscript(
            status="SPEECH",
            text=text,
            execution="LOCAL_CPU",
            egress_attempts=self.egress_attempts,
            sandbox_network="DENY",
            timestamp_state=TIMESTAMP_STATE,
            raw_audio_retained=False,
            audio_sha256=audio_sha,
            media_kind=media_kind,
            pcm_released=True,
            user_transcript_promoted=True,
            duration_ms=duration_ms,
            mode="LOCAL_NEURAL",
            neural_session_ran=True,
            timestamps_proven=False,
            segments=(),
            progress_percent=progress,
            progress_state=progress_state,
            attempts=self._attempts,
            phase="done",
        )

    def probe_segment_timestamps(self, path: Path) -> dict[str, object]:
        """Non-product decode without -nt. Promotes nothing that does not fit duration.

        The qualified Telugu model requires -nt. This probe exists so a timestamp
        claim has to come from the model, and a mismatched window stays unproven.
        """
        if self.closed:
            raise UnsupportedPath("SESSION_CLOSED")
        source = Path(path)
        media_kind = "video-audio" if source.suffix.lower() in _VIDEO_SUFFIXES else "audio"
        wav_path, duration_ms = self._to_wav(source, media_kind)
        stdout, stderr, returncode, spawned = self._infer(wav_path, no_timestamps=False)
        self._release_pcm()
        segments = parse_segment_timestamps(stdout) if spawned and returncode == 0 else []
        proven = segments_fit_duration(segments, duration_ms)
        return {
            "spawned": spawned,
            "returncode": returncode,
            "duration_ms": duration_ms,
            "segments": segments if proven else [],
            "rejected_segments": [] if proven else segments,
            "timestamps_proven": proven,
            "timestamp_state": "PROVEN" if proven else TIMESTAMP_STATE,
            "stderr_progress_state": accepted_progress(stderr)[1],
            "product_flag": "-nt",
        }

    def infer_command(self, wav_path: Path, *, no_timestamps: bool = True) -> list[str]:
        cmd = [
            "/usr/bin/sandbox-exec",
            "-p",
            SANDBOX_PROFILE,
            str(self.assets.cli_path),
            "-m",
            str(self.assets.model_path),
            "-f",
            str(wav_path),
            "-l",
            "te",
            "-np",
            "-pp",
            "-t",
            "2",
            "-p",
            "1",
            "-bo",
            "5",
            "-bs",
            "5",
            "-tp",
            "0",
            "-fa",
            "-ng",
        ]
        if no_timestamps:
            cmd.insert(cmd.index("-l") + 2, "-nt")
        if any(token.startswith("http://") or token.startswith("https://") for token in cmd):
            raise FalseLocalError("local command must not carry a remote URL")
        return cmd

    def _with_progress(
        self,
        result: LocalTranscript,
        progress: int | None,
        progress_state: str,
    ) -> LocalTranscript:
        data = result.to_dict()
        data["progress_percent"] = progress
        data["progress_state"] = progress_state
        data["segments"] = tuple(data["segments"])  # type: ignore[arg-type]
        return LocalTranscript(**data)  # type: ignore[arg-type]

    def _transcript_text(self, stdout: str) -> str:
        """Product path is -nt, so timestamp brackets are not part of the transcript."""
        lines = []
        for line in (stdout or "").splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("[") and "-->" in stripped:
                continue
            lines.append(stripped)
        return " ".join(lines).strip()

    def _sha(self, source: Path) -> str:
        try:
            return hashlib.sha256(source.read_bytes()).hexdigest()
        except OSError:
            return ""

    def _error(
        self,
        code: str,
        detail: str,
        media_kind: str,
        audio_sha: str,
        duration_ms: int,
        *,
        neural: bool,
        progress: int | None = None,
        progress_state: str = "NOT_REPORTED",
    ) -> LocalTranscript:
        self.phase = "error"
        # Corrupt bytes never become a completed fallback transcription.
        if code == "CORRUPT":
            mode = "UNAVAILABLE"
        else:
            mode = resolve_media_mode(
                provider="whisper-cli",
                assets_ready=True,
                neural_session_ran=neural,
            )
        return LocalTranscript(
            status="ERROR",
            text="",
            execution="LOCAL_CPU",
            egress_attempts=self.egress_attempts,
            sandbox_network="DENY",
            timestamp_state=TIMESTAMP_STATE,
            raw_audio_retained=False,
            audio_sha256=audio_sha,
            media_kind=media_kind,
            pcm_released=True,
            user_transcript_promoted=False,
            discarded_model_text=detail[-180:],
            duration_ms=duration_ms,
            mode=mode,
            error_code=code,
            neural_session_ran=neural,
            timestamps_proven=False,
            progress_percent=progress,
            progress_state=progress_state,
            attempts=self._attempts,
            phase="error",
        )

    def _cancelled(self, audio_sha: str, media_kind: str, duration_ms: int, *, neural: bool) -> LocalTranscript:
        self.phase = "cancelled"
        return LocalTranscript(
            status="CANCELLED",
            text="",
            execution="LOCAL_CPU",
            egress_attempts=self.egress_attempts,
            sandbox_network="DENY",
            timestamp_state=TIMESTAMP_STATE,
            raw_audio_retained=False,
            audio_sha256=audio_sha,
            media_kind=media_kind,
            pcm_released=True,
            user_transcript_promoted=False,
            duration_ms=duration_ms,
            mode=resolve_media_mode(provider="whisper-cli", assets_ready=True, neural_session_ran=neural),
            neural_session_ran=neural,
            timestamps_proven=False,
            attempts=self._attempts,
            phase="cancelled",
            error_code="CANCELLED",
        )

    def _release_pcm(self) -> None:
        for buf in self._buffers:
            buf.clear()
        self._buffers.clear()
        self._pcm_released = True

    def _emit(self, phase: str, percent: int | None, note: str) -> None:
        self.phase = phase
        if self.on_progress is None:
            return
        self.on_progress({"phase": phase, "percent": percent, "note": note})

    def _to_wav(self, source: Path, media_kind: str) -> tuple[Path, int]:
        if media_kind == "audio" and source.suffix.lower() == ".wav" and _wav_usable(source):
            return source, _wav_duration_ms(source)
        dest = source.with_suffix(".lane-r3b.wav")
        if dest.exists():
            dest = source.parent / f"{source.stem}.lane-r3b-{os.getpid()}.wav"
        self._temps.append(dest)
        try:
            _run_ffmpeg(
                [
                    _ffmpeg(),
                    "-y",
                    "-i",
                    str(source),
                    "-vn",
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    "-c:a",
                    "pcm_s16le",
                    str(dest),
                ]
            )
        except UnsupportedPath as exc:
            dest.unlink(missing_ok=True)
            detail = str(exc)
            code = "NO_AUDIO_TRACK" if _no_audio_text(detail) else "CORRUPT"
            raise DecodeError(code, detail) from exc
        if not dest.exists() or dest.stat().st_size == 0:
            dest.unlink(missing_ok=True)
            raise DecodeError("CORRUPT", "EMPTY_WAV")
        return dest, _wav_duration_ms(dest)

    def _peak_abs(self, wav_path: Path) -> int:
        with wave.open(str(wav_path), "rb") as handle:
            frames = handle.readframes(handle.getnframes())
        buf = bytearray(frames)
        self._buffers.append(buf)
        if len(buf) < 2:
            return 0
        samples = array.array("h")
        usable = len(buf) - (len(buf) % 2)
        samples.frombytes(bytes(buf[:usable]))
        if not samples:
            return 0
        return max(abs(sample) for sample in samples)

    def _infer(self, wav_path: Path, *, no_timestamps: bool = True) -> tuple[str, str, int, bool]:
        if self._cancel_event.is_set():
            return "", "", -1, False
        cmd = self.infer_command(wav_path, no_timestamps=no_timestamps)
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        self._proc = proc
        spawned = True
        if self._cancel_event.is_set():
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        stdout_b, stderr_b = proc.communicate()
        stdout = (stdout_b or b"").decode("utf-8", errors="replace")
        stderr = (stderr_b or b"").decode("utf-8", errors="replace")
        return stdout, stderr, int(proc.returncode or 0), spawned
