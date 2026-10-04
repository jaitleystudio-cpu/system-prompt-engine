"""Local OCR session over the pinned Tesseract CLI.

This is not a second recognition engine. Inference is the bottle-pinned
`ocr-pack/tesseract` blob, checked before and after a fixed relink, plus
tessdata_fast eng.traineddata at 4.1.0. PATH and the Homebrew cellar binary
are not the product runtime. The product stamp stays HOLD. Text-band
detection is not used.
The image is written only under this pack's session directory and the CLI
runs with network denied. A missing file, a bad hash, a bad size, or the
wrong model fails closed. Loopback is not image egress.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import platform
import shutil
import socket
import subprocess
import tarfile
import threading
import urllib.request
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

HEX = frozenset("0123456789abcdef")
PACK_DIR_NAME = "ocr-pack"
PACK_MANIFEST_NAME = "PACK_MANIFEST.json"
PINNED_PACK_ID = "spe-ocr-tesseract-eng-fast"
PINNED_PACK_VERSION = "1"
PINNED_MODEL_SHA256 = "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2"
PINNED_MODEL_BYTES = 4113088
PINNED_MODEL_REL = "tessdata/eng.traineddata"
PINNED_MODEL_SOURCE = "https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/eng.traineddata"
PINNED_LICENSE = "Apache-2.0"
PINNED_CLI_REL = "tesseract"
PINNED_CLI_LIB_REL = "lib/libtesseract.5.dylib"
PINNED_CLI_BLOB_SHA256 = "1b426db05d316b17d655a76103f2086a83c9af38d2b33b75242be705db0a92e1"
PINNED_CLI_BLOB_BYTES = 70544
PINNED_CLI_SHA256 = "b953aa22b850527259bb595ee69d374013b7101781a7e03fef7d88926e3d616f"
PINNED_CLI_BYTES = 70128
PINNED_CLI_LIB_BLOB_SHA256 = "07918650b59231f1e62baa7bfe483e95a7fe029575d2858d789162cbf8ef40ce"
PINNED_CLI_LIB_BLOB_BYTES = 2857328
PINNED_CLI_LIB_SHA256 = "31fabd39faa9391033d534c794f62537d453714b71e2e481702aed8c87c5635e"
PINNED_CLI_LIB_BYTES = 2840736
PINNED_CLI_BOTTLE_SHA256 = "0059a0945a6d5ac2ef57b084eb2bf87666df0040d22a2ba8cf0448a3fd6b06a9"
PINNED_CLI_BOTTLE_BYTES = 10233009
PINNED_CLI_SOURCE = "https://ghcr.io/v2/homebrew/core/tesseract/blobs/sha256:0059a0945a6d5ac2ef57b084eb2bf87666df0040d22a2ba8cf0448a3fd6b06a9"
PINNED_CLI_TOKEN_URL = "https://ghcr.io/token?service=ghcr.io&scope=repository:homebrew/core/tesseract:pull"
PINNED_HOST_LIBRARY_PREFIX = "/opt/homebrew"
PINNED_CLI_MEMBER = "tesseract/5.5.3/bin/tesseract"
PINNED_CLI_LIB_MEMBER = "tesseract/5.5.3/lib/libtesseract.5.dylib"
PINNED_ENGINE = "tesseract"
PINNED_ENGINE_VERSION = "5.5.3"
PINNED_LANGUAGE = "eng"
SANDBOX_PROFILE = "(version 1)(allow default)(deny network*)"
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost", "0.0.0.0"}
_LOCK = threading.Lock()
_MODEL_INGRESS_HOSTS: list[str] = []
_CLI_INGRESS_HOSTS: list[str] = []
_JOURNEY: dict[str, object] | None = None
_EGRESS_STICKY = 0


class IntegrityError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def pack_root() -> Path:
    return Path(__file__).resolve().parents[2] / PACK_DIR_NAME


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def _load_pack_manifest(root: Path) -> dict[str, object]:
    manifest_path = root / PACK_MANIFEST_NAME
    if not manifest_path.is_file():
        raise IntegrityError("WRONG_MODEL")
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrityError("WRONG_MODEL") from exc
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
    if payload["REAL_SHA256"] != PINNED_MODEL_SHA256 or payload["EXPECTED_BYTES"] != PINNED_MODEL_BYTES:
        raise IntegrityError("WRONG_MODEL")
    if payload["LICENSE"] != PINNED_LICENSE or payload["SOURCE"] != PINNED_MODEL_SOURCE:
        raise IntegrityError("WRONG_MODEL")
    if payload["LANGUAGE_SCOPE"] != [PINNED_LANGUAGE]:
        raise IntegrityError("WRONG_MODEL")
    runtime = payload["RUNTIME_COMPATIBILITY"]
    if not isinstance(runtime, dict):
        raise IntegrityError("WRONG_MODEL")
    expected_runtime = {
        "cli_relative_path": PINNED_CLI_REL,
        "cli_library_relative_path": PINNED_CLI_LIB_REL,
        "cli_sha256": PINNED_CLI_SHA256,
        "cli_bytes": PINNED_CLI_BYTES,
        "cli_blob_sha256": PINNED_CLI_BLOB_SHA256,
        "cli_blob_bytes": PINNED_CLI_BLOB_BYTES,
        "cli_library_sha256": PINNED_CLI_LIB_SHA256,
        "cli_library_bytes": PINNED_CLI_LIB_BYTES,
        "cli_library_blob_sha256": PINNED_CLI_LIB_BLOB_SHA256,
        "cli_library_blob_bytes": PINNED_CLI_LIB_BLOB_BYTES,
        "cli_bottle_sha256": PINNED_CLI_BOTTLE_SHA256,
        "cli_bottle_bytes": PINNED_CLI_BOTTLE_BYTES,
        "cli_source": PINNED_CLI_SOURCE,
        "cli_license": PINNED_LICENSE,
        "host_library_prefix": PINNED_HOST_LIBRARY_PREFIX,
        "engine": PINNED_ENGINE,
        "engine_version": PINNED_ENGINE_VERSION,
        "model_relative_path": PINNED_MODEL_REL,
        "language": PINNED_LANGUAGE,
    }
    for key, value in expected_runtime.items():
        if runtime.get(key) != value:
            if key == "model_relative_path" and (
                not isinstance(runtime.get(key), str) or str(runtime.get(key)).startswith(("/", "\\")) or ".." in str(runtime.get(key))
            ):
                raise IntegrityError("ABSOLUTE_OR_SIBLING_PATH")
            raise IntegrityError("WRONG_MODEL")
    arches = runtime.get("architectures")
    if arches != ["arm64"]:
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    _reject_unrelative(str(runtime["model_relative_path"]))
    return payload


def _host_of(url: str) -> str:
    rest = url.split("://", 1)[-1]
    return rest.split("/", 1)[0].split("@")[-1].split(":")[0].lower()


def _record_ingress(url: str, kind: str) -> None:
    host = _host_of(url)
    bucket = _MODEL_INGRESS_HOSTS if kind == "model" else _CLI_INGRESS_HOSTS
    if host and host not in bucket:
        bucket.append(host)


def _acquire_absent_model(model_path: Path) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    partial = model_path.with_name(model_path.name + ".partial")
    partial.unlink(missing_ok=True)
    digest = hashlib.sha256()
    size = 0
    try:
        request = urllib.request.Request(
            PINNED_MODEL_SOURCE,
            headers={"User-Agent": "spe-ocr/1", "Accept": "application/octet-stream"},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as handle:
            final = str(response.geturl())
            if not final.startswith("https://"):
                raise IntegrityError(
                    "MISSING_MODEL "
                    f"{PINNED_MODEL_REL} sha256={PINNED_MODEL_SHA256} bytes={PINNED_MODEL_BYTES} "
                    f"source={PINNED_MODEL_SOURCE}"
                )
            _record_ingress(PINNED_MODEL_SOURCE, "model")
            _record_ingress(final, "model")
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                size += len(chunk)
                if size > PINNED_MODEL_BYTES:
                    raise IntegrityError("SIZE_MISMATCH")
                digest.update(chunk)
                handle.write(chunk)
        if size != PINNED_MODEL_BYTES:
            raise IntegrityError("SIZE_MISMATCH")
        got = digest.hexdigest()
        if got != PINNED_MODEL_SHA256:
            raise IntegrityError("HASH_MISMATCH")
        os.replace(partial, model_path)
    except IntegrityError:
        partial.unlink(missing_ok=True)
        raise
    except Exception as exc:
        partial.unlink(missing_ok=True)
        raise IntegrityError(
            "MISSING_MODEL "
            f"{PINNED_MODEL_REL} sha256={PINNED_MODEL_SHA256} bytes={PINNED_MODEL_BYTES} "
            f"source={PINNED_MODEL_SOURCE}"
        ) from exc


def _verify_model(path: Path) -> None:
    if not path.is_file():
        raise IntegrityError(
            "MISSING_MODEL "
            f"{PINNED_MODEL_REL} sha256={PINNED_MODEL_SHA256} bytes={PINNED_MODEL_BYTES} "
            f"source={PINNED_MODEL_SOURCE}"
        )
    size = path.stat().st_size
    if size != PINNED_MODEL_BYTES:
        raise IntegrityError("SIZE_MISMATCH")
    got = _sha256_file(path)
    if got != PINNED_MODEL_SHA256:
        raise IntegrityError("HASH_MISMATCH")


def _missing_binary() -> IntegrityError:
    return IntegrityError(
        "MISSING_BINARY "
        f"tesseract blob_sha256={PINNED_CLI_BLOB_SHA256} blob_bytes={PINNED_CLI_BLOB_BYTES} "
        f"executed_sha256={PINNED_CLI_SHA256} executed_bytes={PINNED_CLI_BYTES} "
        f"bottle_sha256={PINNED_CLI_BOTTLE_SHA256} bottle_bytes={PINNED_CLI_BOTTLE_BYTES} "
        f"source={PINNED_CLI_SOURCE}"
    )


def _http_bytes(url: str, headers: dict[str, str], kind: str, expected_bytes: int, *, exact: bool = True) -> bytes:
    _record_ingress(url, kind)
    request = urllib.request.Request(url, headers={"User-Agent": "spe-ocr/1", **headers}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            final = str(response.geturl())
            if not final.startswith("https://"):
                raise _missing_binary()
            _record_ingress(final, kind)
            payload = bytearray()
            while True:
                chunk = response.read(1 << 20)
                if not chunk:
                    break
                if len(payload) + len(chunk) > expected_bytes:
                    raise IntegrityError("SIZE_MISMATCH")
                payload.extend(chunk)
    except IntegrityError:
        raise
    except Exception as exc:
        raise _missing_binary() from exc
    if exact and len(payload) != expected_bytes:
        raise IntegrityError("SIZE_MISMATCH")
    if not payload:
        raise _missing_binary()
    return bytes(payload)


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _require_blob(payload: bytes, expected_sha: str, expected_bytes: int) -> None:
    if len(payload) != expected_bytes:
        raise IntegrityError("SIZE_MISMATCH")
    if _sha256_bytes(payload) != expected_sha:
        raise IntegrityError("HASH_MISMATCH")


def _relink_pinned_cli(cli_path: Path, lib_path: Path) -> None:
    """Deterministic relink of the verified bottle blobs. The executed digest is pinned."""
    prefix = PINNED_HOST_LIBRARY_PREFIX
    bin_changes = [
        (
            "@@HOMEBREW_CELLAR@@/tesseract/5.5.3/lib/libtesseract.5.dylib",
            "@loader_path/lib/libtesseract.5.dylib",
        ),
        (
            "@@HOMEBREW_PREFIX@@/opt/leptonica/lib/libleptonica.6.dylib",
            f"{prefix}/opt/leptonica/lib/libleptonica.6.dylib",
        ),
        (
            "@@HOMEBREW_PREFIX@@/opt/libarchive/lib/libarchive.13.dylib",
            f"{prefix}/opt/libarchive/lib/libarchive.13.dylib",
        ),
    ]
    lib_changes = [
        (
            "@@HOMEBREW_PREFIX@@/opt/leptonica/lib/libleptonica.6.dylib",
            f"{prefix}/opt/leptonica/lib/libleptonica.6.dylib",
        ),
        (
            "@@HOMEBREW_PREFIX@@/opt/libarchive/lib/libarchive.13.dylib",
            f"{prefix}/opt/libarchive/lib/libarchive.13.dylib",
        ),
    ]
    for old, new in bin_changes:
        subprocess.run(["install_name_tool", "-change", old, new, str(cli_path)], check=True, capture_output=True)
    subprocess.run(
        ["install_name_tool", "-id", "@loader_path/libtesseract.5.dylib", str(lib_path)],
        check=True,
        capture_output=True,
    )
    for old, new in lib_changes:
        subprocess.run(["install_name_tool", "-change", old, new, str(lib_path)], check=True, capture_output=True)
    subprocess.run(["codesign", "--force", "--sign", "-", str(cli_path)], check=True, capture_output=True)
    subprocess.run(["codesign", "--force", "--sign", "-", str(lib_path)], check=True, capture_output=True)


def _acquire_absent_cli(root: Path) -> None:
    token_payload = _http_bytes(
        PINNED_CLI_TOKEN_URL,
        {"Accept": "application/json"},
        "cli",
        65536,
        exact=False,
    )
    try:
        token = json.loads(token_payload.decode("utf-8"))["token"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise _missing_binary() from exc
    if not isinstance(token, str) or not token:
        raise _missing_binary()
    bottle = _http_bytes(
        PINNED_CLI_SOURCE,
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.oci.image.layer.v1.tar+gzip",
        },
        "cli",
        PINNED_CLI_BOTTLE_BYTES,
    )
    _require_blob(bottle, PINNED_CLI_BOTTLE_SHA256, PINNED_CLI_BOTTLE_BYTES)
    extracted: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(bottle), mode="r:gz") as archive:
        for name in (PINNED_CLI_MEMBER, PINNED_CLI_LIB_MEMBER):
            member = archive.extractfile(name)
            if member is None:
                raise IntegrityError("WRONG_MODEL")
            extracted[name] = member.read()
    _require_blob(extracted[PINNED_CLI_MEMBER], PINNED_CLI_BLOB_SHA256, PINNED_CLI_BLOB_BYTES)
    _require_blob(extracted[PINNED_CLI_LIB_MEMBER], PINNED_CLI_LIB_BLOB_SHA256, PINNED_CLI_LIB_BLOB_BYTES)
    stage = root / ".bottle"
    if stage.exists():
        shutil.rmtree(stage)
    stage_bin = stage / "tesseract"
    stage_lib = stage / "lib" / "libtesseract.5.dylib"
    stage_lib.parent.mkdir(parents=True)
    stage_bin.write_bytes(extracted[PINNED_CLI_MEMBER])
    stage_lib.write_bytes(extracted[PINNED_CLI_LIB_MEMBER])
    os.chmod(stage_bin, 0o755)
    os.chmod(stage_lib, 0o755)
    try:
        _relink_pinned_cli(stage_bin, stage_lib)
    except subprocess.CalledProcessError as exc:
        raise _missing_binary() from exc
    _require_blob(stage_bin.read_bytes(), PINNED_CLI_SHA256, PINNED_CLI_BYTES)
    _require_blob(stage_lib.read_bytes(), PINNED_CLI_LIB_SHA256, PINNED_CLI_LIB_BYTES)
    cli_path = _member(root, PINNED_CLI_REL)
    lib_path = _member(root, PINNED_CLI_LIB_REL)
    lib_path.parent.mkdir(parents=True, exist_ok=True)
    os.replace(stage_bin, cli_path)
    os.replace(stage_lib, lib_path)
    os.chmod(cli_path, 0o755)
    os.chmod(lib_path, 0o755)


def _verify_cli(path: Path) -> None:
    if not path.is_file():
        raise _missing_binary()
    if "Cellar" in path.parts:
        raise IntegrityError("WRONG_MODEL")
    if path.stat().st_size != PINNED_CLI_BYTES:
        raise IntegrityError("SIZE_MISMATCH")
    if _binary_arch(path) != "arm64" or _host_arch() != "arm64":
        raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
    if _sha256_file(path) != PINNED_CLI_SHA256:
        raise IntegrityError("HASH_MISMATCH")
    if not Path("/usr/bin/sandbox-exec").is_file():
        raise IntegrityError("SANDBOX_UNAVAILABLE")
    completed = subprocess.run(
        ["/usr/bin/sandbox-exec", "-p", SANDBOX_PROFILE, str(path), "--version"],
        capture_output=True,
        text=True,
        check=False,
        timeout=20,
    )
    banner = f"{completed.stdout}\n{completed.stderr}"
    if f"tesseract {PINNED_ENGINE_VERSION}" not in banner:
        raise IntegrityError("WRONG_MODEL")


def _verify_cli_library(path: Path) -> None:
    if not path.is_file():
        raise _missing_binary()
    if path.stat().st_size != PINNED_CLI_LIB_BYTES:
        raise IntegrityError("SIZE_MISMATCH")
    if _sha256_file(path) != PINNED_CLI_LIB_SHA256:
        raise IntegrityError("HASH_MISMATCH")


@dataclass
class QualifiedAssets:
    root: Path
    model_path: Path
    cli_path: Path
    model_acquired: bool = False
    cli_acquired: bool = False
    model_sha256: str = PINNED_MODEL_SHA256
    cli_sha256: str = PINNED_CLI_SHA256


def model_ingress_hosts() -> list[str]:
    with _LOCK:
        return list(_MODEL_INGRESS_HOSTS)


def cli_ingress_hosts() -> list[str]:
    with _LOCK:
        return list(_CLI_INGRESS_HOSTS)


def ingress_hosts() -> list[str]:
    return model_ingress_hosts()


def discover_qualified_assets(
    root: Path | None = None,
    *,
    fetch: bool = True,
) -> QualifiedAssets:
    pack = Path(root) if root is not None else pack_root()
    manifest = _load_pack_manifest(pack)
    runtime = manifest["RUNTIME_COMPATIBILITY"]
    assert isinstance(runtime, dict)
    model_path = _member(pack, str(runtime["model_relative_path"]))
    cli_path = _member(pack, str(runtime["cli_relative_path"]))
    lib_path = _member(pack, str(runtime["cli_library_relative_path"]))
    model_acquired = False
    cli_acquired = False
    if not model_path.is_file():
        if not fetch:
            _verify_model(model_path)
        _acquire_absent_model(model_path)
        model_acquired = True
    _verify_model(model_path)
    if not cli_path.is_file() and not lib_path.is_file():
        if not fetch:
            raise _missing_binary()
        _acquire_absent_cli(pack)
        cli_acquired = True
    elif not cli_path.is_file() or not lib_path.is_file():
        raise _missing_binary()
    _verify_cli(cli_path)
    _verify_cli_library(lib_path)
    return QualifiedAssets(
        root=pack,
        model_path=model_path,
        cli_path=cli_path,
        model_acquired=model_acquired,
        cli_acquired=cli_acquired,
    )


def _image_suffix(blob: bytes) -> str:
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if blob.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if blob.startswith(b"GIF87a") or blob.startswith(b"GIF89a"):
        return ".gif"
    if len(blob) >= 12 and blob.startswith(b"RIFF") and blob[8:12] == b"WEBP":
        return ".webp"
    if blob.startswith(b"II*\x00") or blob.startswith(b"MM\x00*"):
        return ".tif"
    raise IntegrityError("DECODE")


def _loopback(host: str) -> bool:
    token = host.strip().lower()
    if token.startswith("::ffff:"):
        token = token.split("::ffff:", 1)[1]
    return token in LOOPBACK_HOSTS


@contextmanager
def _trace_sockets() -> Iterator[list[dict[str, object]]]:
    attempts: list[dict[str, object]] = []
    real_connect = socket.socket.connect
    real_create = socket.create_connection

    def connect(self: socket.socket, address: object) -> object:
        host = address[0] if isinstance(address, tuple) and address else str(address)
        port = address[1] if isinstance(address, tuple) and len(address) > 1 else None
        attempts.append({"host": str(host), "port": port})
        return real_connect(self, address)  # type: ignore[arg-type]

    def create_connection(address: object, *args: object, **kwargs: object) -> socket.socket:
        host = address[0] if isinstance(address, tuple) and address else str(address)
        port = address[1] if isinstance(address, tuple) and len(address) > 1 else None
        attempts.append({"host": str(host), "port": port})
        return real_create(address, *args, **kwargs)  # type: ignore[arg-type]

    socket.socket.connect = connect  # type: ignore[method-assign]
    socket.create_connection = create_connection  # type: ignore[assignment]
    try:
        yield attempts
    finally:
        socket.socket.connect = real_connect  # type: ignore[method-assign]
        socket.create_connection = real_create  # type: ignore[assignment]


def _parse_tsv(payload: str) -> tuple[str, list[dict[str, object]]]:
    lines = payload.splitlines()
    start = next((index for index, line in enumerate(lines) if line.startswith("level\t")), -1)
    if start < 0:
        raise IntegrityError("ENGINE_FAILED")
    header = lines[start].split("\t")
    wanted = ["level", "block_num", "par_num", "line_num", "word_num", "left", "top", "width", "height", "conf", "text"]
    if any(name not in header for name in wanted):
        raise IntegrityError("ENGINE_FAILED")
    index = {name: header.index(name) for name in wanted}
    page_w = 0
    page_h = 0
    words: list[dict[str, object]] = []
    for line in lines[start + 1 :]:
        cols = line.split("\t")
        if len(cols) <= index["text"]:
            continue
        try:
            level = int(cols[index["level"]])
            left = int(cols[index["left"]])
            top = int(cols[index["top"]])
            width = int(cols[index["width"]])
            height = int(cols[index["height"]])
            conf = float(cols[index["conf"]])
        except ValueError:
            continue
        if level == 1 and width > 0 and height > 0:
            page_w, page_h = width, height
        if level != 5 or conf < 0:
            continue
        text = cols[index["text"]].strip()
        if not text:
            continue
        words.append(
            {
                "block": int(cols[index["block_num"]]),
                "par": int(cols[index["par_num"]]),
                "line": int(cols[index["line_num"]]),
                "word": int(cols[index["word_num"]]),
                "text": text,
                "left": left,
                "top": top,
                "width": width,
                "height": height,
                "conf": conf,
            }
        )
    if page_w <= 0 or page_h <= 0:
        raise IntegrityError("ENGINE_FAILED")
    lines_out: list[str] = []
    current_key: tuple[int, int, int] | None = None
    current_words: list[str] = []
    regions: list[dict[str, object]] = []
    for word in words:
        key = (int(word["block"]), int(word["par"]), int(word["line"]))
        if current_key is None:
            current_key = key
        if key != current_key:
            lines_out.append(" ".join(current_words))
            current_words = []
            current_key = key
        current_words.append(str(word["text"]))
        regions.append(
            {
                "text": word["text"],
                "bounds": {
                    "x": max(0.0, min(1.0, int(word["left"]) / page_w)),
                    "y": max(0.0, min(1.0, int(word["top"]) / page_h)),
                    "w": max(0.0, min(1.0, int(word["width"]) / page_w)),
                    "h": max(0.0, min(1.0, int(word["height"]) / page_h)),
                },
                "confidence": max(0.0, min(1.0, float(word["conf"]) / 100.0)),
            }
        )
    if current_words:
        lines_out.append(" ".join(current_words))
    return "\n".join(lines_out).strip(), regions


@dataclass
class OcrExecution:
    mode: str
    text: str
    regions: list[dict[str, object]]
    error_code: str | None
    egress_attempts: int
    network_hosts: list[str] = field(default_factory=list)
    engine_ran: bool = False


def _fail(code: str, hosts: list[str] | None = None, egress: int = 0) -> OcrExecution:
    return OcrExecution("UNAVAILABLE", "", [], code, egress, hosts or [], False)


class LocalOcrSession:
    def __init__(self, assets: QualifiedAssets) -> None:
        self.assets = assets

    @classmethod
    def open(cls, assets: QualifiedAssets) -> "LocalOcrSession":
        _verify_model(assets.model_path)
        _verify_cli(assets.cli_path)
        return cls(assets)

    def recognize(self, blob: bytes) -> OcrExecution:
        global _EGRESS_STICKY, _JOURNEY
        if not blob or len(blob) > 20 * 1024 * 1024:
            return _fail("DECODE")
        try:
            suffix = _image_suffix(blob)
        except IntegrityError as exc:
            return _fail(exc.code)
        session_dir = self.assets.root / ".session"
        session_dir.mkdir(parents=True, exist_ok=True)
        image_path = session_dir / f"input{suffix}"
        hosts: list[str] = []
        try:
            image_path.write_bytes(blob)
            command = [
                "/usr/bin/sandbox-exec",
                "-p",
                SANDBOX_PROFILE,
                str(self.assets.cli_path),
                str(image_path),
                "stdout",
                "-l",
                PINNED_LANGUAGE,
                "--tessdata-dir",
                str(self.assets.model_path.parent),
                "--psm",
                "3",
                "tsv",
            ]
            with _trace_sockets() as attempts:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    check=False,
                    timeout=60,
                )
            hosts = sorted({str(item["host"]) for item in attempts if not _loopback(str(item["host"]))})
            egress = len(hosts)
            with _LOCK:
                _EGRESS_STICKY += egress
            if completed.returncode != 0:
                return _fail("ENGINE_FAILED", hosts, egress)
            try:
                text, regions = _parse_tsv(completed.stdout)
            except IntegrityError as exc:
                return _fail(exc.code, hosts, egress)
            execution = OcrExecution("LOCAL_OCR", text, regions, None, egress, hosts, True)
            with _LOCK:
                if _EGRESS_STICKY == 0 and text and execution.mode == "LOCAL_OCR":
                    _JOURNEY = {
                        "local_ocr": True,
                        "image_egress": 0,
                        "model_sha256": PINNED_MODEL_SHA256,
                        "model_bytes": PINNED_MODEL_BYTES,
                        "cli_sha256": PINNED_CLI_SHA256,
                        "cli_bytes": PINNED_CLI_BYTES,
                        "text_nonempty": True,
                    }
            return execution
        except subprocess.TimeoutExpired:
            return _fail("ENGINE_FAILED", hosts)
        finally:
            image_path.unlink(missing_ok=True)


def recorded_journey() -> dict[str, object] | None:
    with _LOCK:
        if _JOURNEY is None:
            return None
        return dict(_JOURNEY)


def product_verdict() -> dict[str, object]:
    """Product stamp stays HOLD. LOCAL_OCR is execution evidence, not a release pass."""
    with _LOCK:
        journey = None if _JOURNEY is None else dict(_JOURNEY)
        egress = _EGRESS_STICKY
        model_hosts = list(_MODEL_INGRESS_HOSTS)
        cli_hosts = list(_CLI_INGRESS_HOSTS)
    execution = "NOT_RUN"
    if (
        egress == 0
        and isinstance(journey, dict)
        and journey.get("local_ocr") is True
        and journey.get("text_nonempty") is True
        and journey.get("model_sha256") == PINNED_MODEL_SHA256
        and journey.get("model_bytes") == PINNED_MODEL_BYTES
        and journey.get("cli_sha256") == PINNED_CLI_SHA256
        and journey.get("cli_bytes") == PINNED_CLI_BYTES
        and journey.get("image_egress") == 0
    ):
        execution = "LOCAL_OCR"
    return {
        "OCR_PRODUCT": "HOLD",
        "execution": execution,
        "missing": "RELEASE_NOT_QUALIFIED",
        "modelIngressHosts": model_hosts,
        "cliIngressHosts": cli_hosts,
        "ingressHosts": model_hosts,
        "imageEgressAttempts": egress,
    }


def reset_journey_for_tests() -> None:
    global _JOURNEY, _EGRESS_STICKY
    with _LOCK:
        _JOURNEY = None
        _EGRESS_STICKY = 0
