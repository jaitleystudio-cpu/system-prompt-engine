"""Local OCR session over the pinned Tesseract CLI.

This is not a second recognition engine. Inference is the bottle-pinned
`ocr-pack/tesseract` blob plus the vendored leptonica and libarchive closure
under `ocr-pack/lib`. Install names are rewritten to `@loader_path` and checked
before use. `/opt/homebrew` is not a runtime load path. PATH and the Homebrew
cellar binary are not the product runtime. The product stamp stays HOLD.
Text-band detection is not used.
The image is written only under this pack's session directory and the CLI
runs with network denied. A missing file, a bad hash, a bad size, an absolute
load path outside the macOS system libraries, or the wrong model fails closed.
Loopback is not image egress.
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
PINNED_CLI_SHA256 = "42ac364d327a170b3f36ae0c34c32744e06783257eb5bf6c1f48f88fe54104e8"
PINNED_CLI_BYTES = 70128
PINNED_CLI_LIB_BLOB_SHA256 = "07918650b59231f1e62baa7bfe483e95a7fe029575d2858d789162cbf8ef40ce"
PINNED_CLI_LIB_BLOB_BYTES = 2857328
PINNED_CLI_LIB_SHA256 = "b5755a12d8914db73be9b1b64d1fe68e04f7e83d22d93301469e51a7a87c5a5c"
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
# tessdata_fast 4.1.0 packs. eng remains the product model. tel, hin, and tam are
# pinned the same way and are not a product pass.
PINNED_LANGUAGE_PACKS = (
    {
        "language": "eng",
        "relative_path": "tessdata/eng.traineddata",
        "sha256": "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2",
        "bytes": 4113088,
        "license": "Apache-2.0",
        "source": "https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/eng.traineddata",
    },
    {
        "language": "tel",
        "relative_path": "tessdata/tel.traineddata",
        "sha256": "d10691fddd5b67802e1c12800ebb321d3b8bcd8d24a2ac3ff206f93188c04ab5",
        "bytes": 2769654,
        "license": "Apache-2.0",
        "source": "https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/tel.traineddata",
    },
    {
        "language": "hin",
        "relative_path": "tessdata/hin.traineddata",
        "sha256": "4c73ffc59d497c186b19d1e90f5d721d678ea6b2e277b719bee4e2af12271825",
        "bytes": 1122751,
        "license": "Apache-2.0",
        "source": "https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/hin.traineddata",
    },
    {
        "language": "tam",
        "relative_path": "tessdata/tam.traineddata",
        "sha256": "d02fbec24be4b07e32e80d0ccfc3b6b67a3c5d61c9d0a7c8532677990912c6ec",
        "bytes": 3237963,
        "license": "Apache-2.0",
        "source": "https://github.com/tesseract-ocr/tessdata_fast/raw/4.1.0/tam.traineddata",
    },
)
SYSTEM_LOAD_PREFIXES = ("/usr/lib/", "/System/Library/")
# Bottle members only. Executed digests are after @loader_path rewrite and ad-hoc sign.
# Relink order is this order. Bottles are downloaded, checked, and not committed.
# liblzma is the 0BSD library only; GPL-2.0-or-later xz tools are not extracted.
# libzstd is recorded under BSD-3-Clause; its GPL-2.0-only alternative is not selected.
PINNED_VENDORED_LIBRARIES = (
    {
        "relative_path": "lib/libtesseract.5.dylib",
        "formula": "tesseract",
        "version": "5.5.3",
        "license": "Apache-2.0",
        "member": "tesseract/5.5.3/lib/libtesseract.5.dylib",
        "blob_sha256": "07918650b59231f1e62baa7bfe483e95a7fe029575d2858d789162cbf8ef40ce",
        "blob_bytes": 2857328,
        "sha256": "b5755a12d8914db73be9b1b64d1fe68e04f7e83d22d93301469e51a7a87c5a5c",
        "bytes": 2840736,
        "bottle_sha256": "0059a0945a6d5ac2ef57b084eb2bf87666df0040d22a2ba8cf0448a3fd6b06a9",
        "bottle_bytes": 10233009,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/tesseract/blobs/sha256:0059a0945a6d5ac2ef57b084eb2bf87666df0040d22a2ba8cf0448a3fd6b06a9",
    },
    {
        "relative_path": "lib/libleptonica.6.dylib",
        "formula": "leptonica",
        "version": "1.87.0",
        "license": "BSD-2-Clause",
        "member": "leptonica/1.87.0/lib/libleptonica.6.dylib",
        "blob_sha256": "91475fa08a98da1930a9d90a393eded1057ad766c19452a07021a877ebeac8c3",
        "blob_bytes": 2186720,
        "sha256": "2b20ae9232e19bc6ee582a5da6e64c8958e5d07012ee2efdfd3ce2b35219d65f",
        "bytes": 2174032,
        "bottle_sha256": "724c8c7898e9483c4d9bf610b0c6f7b47b409b66be866e96ab53b98b0283f117",
        "bottle_bytes": 2646674,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/leptonica/blobs/sha256:724c8c7898e9483c4d9bf610b0c6f7b47b409b66be866e96ab53b98b0283f117",
    },
    {
        "relative_path": "lib/libarchive.13.dylib",
        "formula": "libarchive",
        "version": "3.8.9",
        "license": "BSD-2-Clause",
        "member": "libarchive/3.8.9/lib/libarchive.13.dylib",
        "blob_sha256": "5bc66fa4d08e8ef035a3009a934fc492ddb43446aef7cc675af56bab996c6ec5",
        "blob_bytes": 689440,
        "sha256": "7979546fbe48e4dda94b7e34735df917c5c7a3376c29b36960dcb5164e0d4e07",
        "bytes": 685456,
        "bottle_sha256": "f5da77f1b589e76374e4499a8065e2a0972c382edd0825f957c70678c9329ca8",
        "bottle_bytes": 1628026,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/libarchive/blobs/sha256:f5da77f1b589e76374e4499a8065e2a0972c382edd0825f957c70678c9329ca8",
    },
    {
        "relative_path": "lib/libpng16.16.dylib",
        "formula": "libpng",
        "version": "1.6.59",
        "license": "libpng-2.0",
        "member": "libpng/1.6.59/lib/libpng16.16.dylib",
        "blob_sha256": "bd86c88b896a260a5cfa1294cdcedc435ff5ce8482ecaa528a8d55529618d7ac",
        "blob_bytes": 191344,
        "sha256": "c5cd335651052515515d92db5f36445ff2a1e2e807132ce559a7c6a06d4fba0a",
        "bytes": 190272,
        "bottle_sha256": "7e04225ac0bc048d2b12c603f678e5fa36459909812f2f1306dbd97af337cdec",
        "bottle_bytes": 459417,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/libpng/blobs/sha256:7e04225ac0bc048d2b12c603f678e5fa36459909812f2f1306dbd97af337cdec",
    },
    {
        "relative_path": "lib/libjpeg.8.dylib",
        "formula": "jpeg-turbo",
        "version": "3.2.0",
        "license": "IJG AND Zlib AND BSD-3-Clause",
        "member": "jpeg-turbo/3.2.0/lib/libjpeg.8.3.2.dylib",
        "blob_sha256": "cd6f2a3ce3f6eb31f4700d2000b7be187264b7641af7ce888ed5caa3656e9263",
        "blob_bytes": 456896,
        "sha256": "e1a96f7d24e65399219368b236f81ed7085b6ed648b1fc9ee3d40cb5cf75a477",
        "bytes": 454256,
        "bottle_sha256": "7bc0f7c007a73c68da8c11055e836de66c2814c1b0ca0302da9a6317199fd37a",
        "bottle_bytes": 1342462,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/jpeg-turbo/blobs/sha256:7bc0f7c007a73c68da8c11055e836de66c2814c1b0ca0302da9a6317199fd37a",
    },
    {
        "relative_path": "lib/libgif.dylib",
        "formula": "giflib",
        "version": "6.1.3",
        "license": "MIT",
        "member": "giflib/6.1.3/lib/libgif.7.2.0.dylib",
        "blob_sha256": "3b6638ab12344d3766fb2104b51b6ad65cfcb0046e57aa34c91699ef4ae59122",
        "blob_bytes": 54976,
        "sha256": "e8202a5bd9d4178704305173a415214bd2d69082c17b0f557e2a84b969056a21",
        "bytes": 54704,
        "bottle_sha256": "bdf5a53f053c10c716573cf955e5f50d704d97f9d2dedc781161031744b77849",
        "bottle_bytes": 143232,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/giflib/blobs/sha256:bdf5a53f053c10c716573cf955e5f50d704d97f9d2dedc781161031744b77849",
    },
    {
        "relative_path": "lib/libtiff.6.dylib",
        "formula": "libtiff",
        "version": "4.7.2",
        "license": "libtiff",
        "member": "libtiff/4.7.2/lib/libtiff.6.dylib",
        "blob_sha256": "fe79c26c2eda406057f50f19b110ce2a5a7d944bb7dd9013eca8a96b2df0d23f",
        "blob_bytes": 528560,
        "sha256": "d1686cdc9e9aaa9769694be1ed0772dc5ec48e1f87a4df7ce72870e7c4290be7",
        "bytes": 525504,
        "bottle_sha256": "2678f5bb80b0578e79c76f747b637781ab3629b0c393e8c7d060ead4d42f9d6c",
        "bottle_bytes": 1968537,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/libtiff/blobs/sha256:2678f5bb80b0578e79c76f747b637781ab3629b0c393e8c7d060ead4d42f9d6c",
    },
    {
        "relative_path": "lib/libwebp.7.dylib",
        "formula": "webp",
        "version": "1.6.0",
        "license": "BSD-3-Clause",
        "member": "webp/1.6.0/lib/libwebp.7.2.0.dylib",
        "blob_sha256": "e1af82e777adcbeb288eb5b27493f9c1af0ac7696d1fedebef273ef56a72e994",
        "blob_bytes": 336208,
        "sha256": "2580c323bf9dc080ca6619ff50ec67f00129a16ca1719315b3f1f8deb9821bd2",
        "bytes": 334272,
        "bottle_sha256": "85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
        "bottle_bytes": 893595,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/webp/blobs/sha256:85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
    },
    {
        "relative_path": "lib/libwebpmux.3.dylib",
        "formula": "webp",
        "version": "1.6.0",
        "license": "BSD-3-Clause",
        "member": "webp/1.6.0/lib/libwebpmux.3.1.2.dylib",
        "blob_sha256": "6037eebbc63bb657a73df2daed369a74d824bed6cd4780783c7b93a905fba257",
        "blob_bytes": 55504,
        "sha256": "114a9a3d79b2d1df5d5beb8f0181a4388d5d9df76903cee79dccfd692ce4184e",
        "bytes": 55184,
        "bottle_sha256": "85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
        "bottle_bytes": 893595,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/webp/blobs/sha256:85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
    },
    {
        "relative_path": "lib/libsharpyuv.0.dylib",
        "formula": "webp",
        "version": "1.6.0",
        "license": "BSD-3-Clause",
        "member": "webp/1.6.0/lib/libsharpyuv.0.1.2.dylib",
        "blob_sha256": "9de7b53b20992f9e70036ca1865c0ef23c11e34c525f0baf7b8508402f299bfd",
        "blob_bytes": 51872,
        "sha256": "bb247f4ed5509e7baacfc23f4cb31ca2909f8c8bfd3921a78548f7eb8c894850",
        "bytes": 51584,
        "bottle_sha256": "85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
        "bottle_bytes": 893595,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/webp/blobs/sha256:85d3cb86c87f53f027b48cdfe15a31e82932caa43344a6fe06e00e5de402a3e7",
    },
    {
        "relative_path": "lib/libopenjp2.7.dylib",
        "formula": "openjpeg",
        "version": "2.5.4",
        "license": "BSD-2-Clause",
        "member": "openjpeg/2.5.4_1/lib/libopenjp2.2.5.4.dylib",
        "blob_sha256": "fe1c40644c52516387bb32b3874e21360cc96d09a7112fc4f97fee2bc78db352",
        "blob_bytes": 307888,
        "sha256": "4336c21da827786af7271123e36320f05fa866bc7a142e5089c2dda2ca1787be",
        "bytes": 306128,
        "bottle_sha256": "031d1267409505d3e26249e279633b21a55799c99ad7ce6cb0a8ede0fd8779fb",
        "bottle_bytes": 2211429,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/openjpeg/blobs/sha256:031d1267409505d3e26249e279633b21a55799c99ad7ce6cb0a8ede0fd8779fb",
    },
    {
        "relative_path": "lib/liblzma.5.dylib",
        "formula": "xz",
        "version": "5.8.4",
        "license": "0BSD",
        "member": "xz/5.8.4/lib/liblzma.5.dylib",
        "blob_sha256": "6bdd176f89881df430ea60d99ef4fb6094d1717454a04de6860404209d9ccfa0",
        "blob_bytes": 167520,
        "sha256": "8a6c4bf21391271d02f3f618dd476de7a14427a5842c8617f8d6a11d89ef4f34",
        "bytes": 166576,
        "bottle_sha256": "b2b5d6523153be05c20bcc51cd358ea3dd1f4bf893748fdedb779ab508ea63ce",
        "bottle_bytes": 788797,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/xz/blobs/sha256:b2b5d6523153be05c20bcc51cd358ea3dd1f4bf893748fdedb779ab508ea63ce",
    },
    {
        "relative_path": "lib/libzstd.1.dylib",
        "formula": "zstd",
        "version": "1.5.7",
        "license": "BSD-3-Clause",
        "member": "zstd/1.5.7_1/lib/libzstd.1.5.7.dylib",
        "blob_sha256": "29b406c9acbf1da657a836fe2b0943fbd6813873b21bebfd4073e487e9d39dc3",
        "blob_bytes": 635280,
        "sha256": "fce56e34e29cbaa93316e07babba0a9c0fe318a69bb1171de75b0be0a9ee9221",
        "bytes": 631616,
        "bottle_sha256": "7fb4af03304cc4897326168cdcd53290311c5543150f5502a61c3e84b6d62765",
        "bottle_bytes": 795238,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/zstd/blobs/sha256:7fb4af03304cc4897326168cdcd53290311c5543150f5502a61c3e84b6d62765",
    },
    {
        "relative_path": "lib/liblz4.1.dylib",
        "formula": "lz4",
        "version": "1.10.0",
        "license": "BSD-2-Clause",
        "member": "lz4/1.10.0/lib/liblz4.1.10.0.dylib",
        "blob_sha256": "84f18a44dd2187f6a5f1d96bcae5203fd0a44e9622cdc4ca6e19f393d2bec7e8",
        "blob_bytes": 161808,
        "sha256": "220d23dec4de41164e12129fbe558d90f231c755a11b57a2633ad082ddeecc87",
        "bytes": 160896,
        "bottle_sha256": "53ea7532077fe43abfe3d6e0d9991ebc8370e9edcc508f997c92902d60c8b151",
        "bottle_bytes": 286877,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/lz4/blobs/sha256:53ea7532077fe43abfe3d6e0d9991ebc8370e9edcc508f997c92902d60c8b151",
    },
    {
        "relative_path": "lib/libb2.1.dylib",
        "formula": "libb2",
        "version": "0.98.1",
        "license": "CC0-1.0",
        "member": "libb2/0.98.1/lib/libb2.1.dylib",
        "blob_sha256": "436882a91f01cdcf83342706a01ee6c4ce9b6710c0f2908579e9b740bce557ac",
        "blob_bytes": 67920,
        "sha256": "808115d6cc2b0db093f002e3f9f3f1e415ddf52addaaddf211361dfcfa91b4d1",
        "bytes": 67584,
        "bottle_sha256": "b129b1449d32b734bff99c505443981e301110ee1073131544102354acdd659f",
        "bottle_bytes": 32932,
        "bottle_source": "https://ghcr.io/v2/homebrew/core/libb2/blobs/sha256:b129b1449d32b734bff99c505443981e301110ee1073131544102354acdd659f",
    },
)
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
    pinned_scope = [str(item["language"]) for item in PINNED_LANGUAGE_PACKS]
    if payload["LANGUAGE_SCOPE"] != pinned_scope:
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
        "language_packs": [dict(item) for item in PINNED_LANGUAGE_PACKS],
        "vendored_libraries": [dict(item) for item in PINNED_VENDORED_LIBRARIES],
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


def _language_pack(language: str) -> dict[str, object]:
    for item in PINNED_LANGUAGE_PACKS:
        if item["language"] == language:
            return item
    raise IntegrityError("WRONG_MODEL")


def _missing_model(item: dict[str, object]) -> IntegrityError:
    return IntegrityError(
        "MISSING_MODEL "
        f"{item['relative_path']} sha256={item['sha256']} bytes={item['bytes']} "
        f"source={item['source']}"
    )


def _acquire_absent_model(model_path: Path, item: dict[str, object] | None = None) -> None:
    pack = item if item is not None else _language_pack(PINNED_LANGUAGE)
    expected_bytes = int(pack["bytes"])
    expected_sha = str(pack["sha256"])
    source = str(pack["source"])
    model_path.parent.mkdir(parents=True, exist_ok=True)
    partial = model_path.with_name(model_path.name + ".partial")
    partial.unlink(missing_ok=True)
    digest = hashlib.sha256()
    size = 0
    try:
        request = urllib.request.Request(
            source,
            headers={"User-Agent": "spe-ocr/1", "Accept": "application/octet-stream"},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as handle:
            final = str(response.geturl())
            if not final.startswith("https://"):
                raise _missing_model(pack)
            _record_ingress(source, "model")
            _record_ingress(final, "model")
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
            raise IntegrityError("SIZE_MISMATCH")
        if digest.hexdigest() != expected_sha:
            raise IntegrityError("HASH_MISMATCH")
        os.replace(partial, model_path)
    except IntegrityError:
        partial.unlink(missing_ok=True)
        raise
    except Exception as exc:
        partial.unlink(missing_ok=True)
        raise _missing_model(pack) from exc


def _verify_model(path: Path, item: dict[str, object] | None = None) -> None:
    pack = item if item is not None else _language_pack(PINNED_LANGUAGE)
    if not path.is_file():
        raise _missing_model(pack)
    if path.stat().st_size != int(pack["bytes"]):
        raise IntegrityError("SIZE_MISMATCH")
    if _sha256_file(path) != str(pack["sha256"]):
        raise IntegrityError("HASH_MISMATCH")


def ensure_language_pack(root: Path, language: str, *, fetch: bool = True) -> tuple[Path, bool]:
    """Absence downloads the pinned tessdata_fast pack. A present wrong file is not replaced."""
    pack = _language_pack(language)
    path = _member(root, str(pack["relative_path"]))
    acquired = False
    if not path.is_file():
        if not fetch:
            raise _missing_model(pack)
        _acquire_absent_model(path, pack)
        acquired = True
    _verify_model(path, pack)
    return path, acquired


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


def _load_commands(path: Path) -> list[str]:
    completed = subprocess.run(["otool", "-L", str(path)], capture_output=True, text=True, check=False)
    if completed.returncode != 0 or not completed.stdout:
        raise IntegrityError("LOAD_PATH")
    commands: list[str] = []
    for line in completed.stdout.splitlines()[1:]:
        command = line.strip().split(" (compatibility", 1)[0].strip()
        if command:
            commands.append(command)
    if not commands:
        raise IntegrityError("LOAD_PATH")
    return commands


def _assert_closed_load_commands(paths: list[Path]) -> None:
    """Refuse Homebrew and any absolute path that is not a macOS system library."""
    names = {path.name for path in paths if path.name != PINNED_CLI_REL}
    for path in paths:
        commands = _load_commands(path)
        is_library = path.name != PINNED_CLI_REL
        if is_library:
            if commands[0] != f"@loader_path/{path.name}":
                raise IntegrityError("LOAD_PATH")
        for command in commands[(1 if is_library else 0) :]:
            if PINNED_HOST_LIBRARY_PREFIX in command or command.startswith("@@"):
                raise IntegrityError("LOAD_PATH")
            if command.startswith(SYSTEM_LOAD_PREFIXES):
                continue
            if command.startswith("@loader_path/"):
                rest = command[len("@loader_path/") :]
                if is_library:
                    if rest not in names or "/" in rest:
                        raise IntegrityError("LOAD_PATH")
                elif rest.count("/") != 1 or not rest.startswith("lib/") or rest.rsplit("/", 1)[1] not in names:
                    raise IntegrityError("LOAD_PATH")
                continue
            raise IntegrityError("LOAD_PATH")


def _relink_pinned_cli(cli_path: Path, libraries: list[Path]) -> None:
    """Deterministic @loader_path rewrite. The executed digests are pinned."""
    names = {path.name for path in libraries}
    files = [cli_path, *libraries]
    try:
        for path in files:
            commands = _load_commands(path)
            is_library = path in libraries
            if is_library:
                subprocess.run(
                    ["install_name_tool", "-id", f"@loader_path/{path.name}", str(path)],
                    check=True,
                    capture_output=True,
                )
            for command in commands[(1 if is_library else 0) :]:
                if command.startswith(SYSTEM_LOAD_PREFIXES):
                    continue
                base = Path(command).name
                if base not in names:
                    raise IntegrityError("LOAD_PATH")
                new = f"@loader_path/{base}" if is_library else f"@loader_path/lib/{base}"
                subprocess.run(
                    ["install_name_tool", "-change", command, new, str(path)],
                    check=True,
                    capture_output=True,
                )
        for path in files:
            subprocess.run(["codesign", "--force", "--sign", "-", str(path)], check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        raise _missing_binary() from exc
    _assert_closed_load_commands(files)


def _tar_member(payload: bytes, name: str) -> bytes:
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        member = archive.extractfile(name)
        if member is None:
            raise IntegrityError("WRONG_MODEL")
        return member.read()


def _fetch_ghcr_bottle(formula: str, source: str, sha: str, size: int) -> bytes:
    token_payload = _http_bytes(
        f"https://ghcr.io/token?service=ghcr.io&scope=repository:homebrew/core/{formula}:pull",
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
        source,
        {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.oci.image.layer.v1.tar+gzip",
        },
        "cli",
        size,
    )
    _require_blob(bottle, sha, size)
    return bottle


def _acquire_absent_cli(root: Path) -> None:
    bottles: dict[str, bytes] = {}
    staged: list[tuple[dict[str, object], Path]] = []
    stage = root / ".bottle"
    if stage.exists():
        shutil.rmtree(stage)
    stage_lib = stage / "lib"
    stage_lib.mkdir(parents=True)
    stage_bin = stage / "tesseract"
    try:
        cli_bottle = _fetch_ghcr_bottle("tesseract", PINNED_CLI_SOURCE, PINNED_CLI_BOTTLE_SHA256, PINNED_CLI_BOTTLE_BYTES)
        bottles[PINNED_CLI_SOURCE] = cli_bottle
        cli_blob = _tar_member(cli_bottle, PINNED_CLI_MEMBER)
        _require_blob(cli_blob, PINNED_CLI_BLOB_SHA256, PINNED_CLI_BLOB_BYTES)
        stage_bin.write_bytes(cli_blob)
        os.chmod(stage_bin, 0o755)
        for item in PINNED_VENDORED_LIBRARIES:
            source = str(item["bottle_source"])
            if source not in bottles:
                bottles[source] = _fetch_ghcr_bottle(
                    str(item["formula"]),
                    source,
                    str(item["bottle_sha256"]),
                    int(item["bottle_bytes"]),
                )
            blob = _tar_member(bottles[source], str(item["member"]))
            _require_blob(blob, str(item["blob_sha256"]), int(item["blob_bytes"]))
            path = stage_lib / Path(str(item["relative_path"])).name
            path.write_bytes(blob)
            os.chmod(path, 0o755)
            staged.append((item, path))
        _relink_pinned_cli(stage_bin, [path for _, path in staged])
        _require_blob(stage_bin.read_bytes(), PINNED_CLI_SHA256, PINNED_CLI_BYTES)
        for item, path in staged:
            _require_blob(path.read_bytes(), str(item["sha256"]), int(item["bytes"]))
        cli_path = _member(root, PINNED_CLI_REL)
        os.replace(stage_bin, cli_path)
        os.chmod(cli_path, 0o755)
        for item, path in staged:
            dest = _member(root, str(item["relative_path"]))
            dest.parent.mkdir(parents=True, exist_ok=True)
            os.replace(path, dest)
            os.chmod(dest, 0o755)
    except IntegrityError:
        raise
    except Exception as exc:
        raise _missing_binary() from exc
    finally:
        if stage.exists():
            shutil.rmtree(stage, ignore_errors=True)


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


def _verify_vendored_libraries(root: Path, cli_path: Path) -> None:
    paths = [cli_path]
    for item in PINNED_VENDORED_LIBRARIES:
        path = _member(root, str(item["relative_path"]))
        if not path.is_file():
            raise _missing_binary()
        if path.stat().st_size != int(item["bytes"]):
            raise IntegrityError("SIZE_MISMATCH")
        if _binary_arch(path) != "arm64":
            raise IntegrityError("UNSUPPORTED_ARCHITECTURE")
        if _sha256_file(path) != str(item["sha256"]):
            raise IntegrityError("HASH_MISMATCH")
        paths.append(path)
    _assert_closed_load_commands(paths)



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
    lib_paths = [_member(pack, str(item["relative_path"])) for item in PINNED_VENDORED_LIBRARIES]
    model_acquired = False
    cli_acquired = False
    if not model_path.is_file():
        if not fetch:
            _verify_model(model_path)
        _acquire_absent_model(model_path)
        model_acquired = True
    _verify_model(model_path)
    for extra in PINNED_LANGUAGE_PACKS:
        if extra["language"] == PINNED_LANGUAGE:
            continue
        extra_path = _member(pack, str(extra["relative_path"]))
        if not extra_path.is_file():
            if fetch:
                _acquire_absent_model(extra_path, extra)
                _verify_model(extra_path, extra)
        else:
            _verify_model(extra_path, extra)
    cli_files = [cli_path, *lib_paths]
    present = [path.is_file() for path in cli_files]
    if not any(present):
        if not fetch:
            raise _missing_binary()
        _acquire_absent_cli(pack)
        cli_acquired = True
    elif not all(present):
        raise _missing_binary()
    _verify_cli(cli_path)
    _verify_vendored_libraries(pack, cli_path)
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

    def recognize(self, blob: bytes, language: str = PINNED_LANGUAGE) -> OcrExecution:
        global _EGRESS_STICKY, _JOURNEY
        if not blob or len(blob) > 20 * 1024 * 1024:
            return _fail("DECODE")
        try:
            suffix = _image_suffix(blob)
            pack = _language_pack(language)
            model_path = _member(self.assets.root, str(pack["relative_path"]))
            _verify_model(model_path, pack)
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
                language,
                "--tessdata-dir",
                str(model_path.parent),
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
                if language == PINNED_LANGUAGE and _EGRESS_STICKY == 0 and text and execution.mode == "LOCAL_OCR":
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
