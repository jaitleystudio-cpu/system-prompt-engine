"""P0-1 OCR: pinned Tesseract, not a second engine and not a fixture echo."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from spe_runtime.ocr_product.local_backend import (  # noqa: E402
    IntegrityError,
    LocalOcrSession,
    PINNED_CLI_BLOB_SHA256,
    PINNED_CLI_BYTES,
    PINNED_CLI_SHA256,
    PINNED_MODEL_BYTES,
    PINNED_MODEL_SHA256,
    cli_ingress_hosts,
    discover_qualified_assets,
    model_ingress_hosts,
    product_verdict,
    reset_journey_for_tests,
)

PROOF = "SPE OCR LANE R6 HOLDFAST"
SECOND = "NORTH DOCK 17"
RUNTIME_FILES = [
    ROOT / "spe_runtime/ocr_product/local_backend.py",
    ROOT / "spe_runtime/ocr_product/route_host.py",
    ROOT / "apps/web/src/media/ocrLite.ts",
    ROOT / "apps/web/src/media/OcrRoute.tsx",
    ROOT / "ocr-pack/PACK_MANIFEST.json",
]


def fail(message: str) -> None:
    raise SystemExit(message)


def assert_true(cond: bool, message: str) -> None:
    if not cond:
        fail(message)


def copy_manifest(directory: Path, **updates: object) -> None:
    payload = json.loads((ROOT / "ocr-pack/PACK_MANIFEST.json").read_text(encoding="utf-8"))
    payload.update(updates)
    (directory / "PACK_MANIFEST.json").write_text(json.dumps(payload), encoding="utf-8")


def test_rejects() -> None:
    with tempfile.TemporaryDirectory() as raw:
        directory = Path(raw)
        copy_manifest(directory, MODEL_PACK_ID="spe-ocr-other")
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code == "WRONG_MODEL", exc.code)
        else:
            fail("wrong model id was accepted")

        copy_manifest(directory)
        runtime = json.loads((directory / "PACK_MANIFEST.json").read_text(encoding="utf-8"))
        runtime["RUNTIME_COMPATIBILITY"]["model_relative_path"] = "/tmp/eng.traineddata"
        (directory / "PACK_MANIFEST.json").write_text(json.dumps(runtime), encoding="utf-8")
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code == "ABSOLUTE_OR_SIBLING_PATH", exc.code)
        else:
            fail("absolute model path was accepted")

        copy_manifest(directory)
        model = directory / "tessdata/eng.traineddata"
        model.parent.mkdir(parents=True)
        model.write_bytes(b"short")
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code == "SIZE_MISMATCH", exc.code)
        else:
            fail("short model was accepted")

        model.write_bytes(b"x" * PINNED_MODEL_BYTES)
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code == "HASH_MISMATCH", exc.code)
        else:
            fail("wrong digest was accepted")

        model.unlink()
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code.startswith("MISSING_MODEL "), exc.code)
            assert_true(PINNED_MODEL_SHA256 in exc.code, exc.code)
            assert_true(str(PINNED_MODEL_BYTES) in exc.code, exc.code)
        else:
            fail("missing model was accepted")




def render_proof(path: Path, phrase: str) -> None:
    program = """
import AppKit
let text = %s
let out = %s
let width = 1200
let height = 180
let img = NSImage(size: NSSize(width: width, height: height))
img.lockFocus()
NSColor.white.setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
let font = NSFont(name: "Arial", size: 64) ?? NSFont.systemFont(ofSize: 64)
let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
(text as NSString).draw(at: NSPoint(x: 40, y: 50), withAttributes: attrs)
img.unlockFocus()
guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else {
  exit(1)
}
try png.write(to: URL(fileURLWithPath: out))
""" % (json.dumps(phrase), json.dumps(str(path)))
    completed = subprocess.run(["swift", "-"], input=program, text=True, capture_output=True, check=False)
    if completed.returncode != 0 or not path.is_file():
        fail("could not render proof image: " + completed.stderr[-500:])


def _park(src: Path, dest: Path) -> None:
    if not src.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(src, dest)


def _restore(parked: Path, dest: Path) -> None:
    if dest.exists() or not parked.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(parked, dest)


def _assert_closed_loads(path: Path) -> None:
    out = subprocess.check_output(["otool", "-L", str(path)], text=True)
    assert_true("/opt/homebrew" not in out, out)
    assert_true("@@HOMEBREW" not in out, out)
    for line in out.splitlines()[1:]:
        command = line.strip().split(" (compatibility", 1)[0].strip()
        if command.startswith("@loader_path/"):
            continue
        if command.startswith("/usr/lib/") or command.startswith("/System/Library/"):
            continue
        fail(command)


def _recognize(phrase: str) -> bytes:
    assets_root = ROOT / "ocr-pack"
    session = assets_root / ".session"
    session.mkdir(parents=True, exist_ok=True)
    image = session / "generated-proof.png"
    render_proof(image, phrase)
    blob = image.read_bytes()
    image.unlink()
    return blob


def test_sources_do_not_embed_the_proof() -> None:
    for path in RUNTIME_FILES:
        text = path.read_text(encoding="utf-8")
        assert_true("HOLDFAST" not in text, str(path))
        assert_true("NORTH DOCK" not in text, str(path))
        assert_true("/Volumes/" not in text, str(path))
        assert_true("spe-worktrees" not in text, str(path))
        assert_true("OCR_PRODUCT=PASS" not in text, str(path))
        assert_true('"OCR_PRODUCT": "PASS"' not in text, str(path))
    route = (ROOT / "apps/web/src/media/OcrRoute.tsx").read_text(encoding="utf-8")
    owner = (ROOT / "apps/web/src/media/ocrLite.ts").read_text(encoding="utf-8")
    backend = (ROOT / "spe_runtime/ocr_product/local_backend.py").read_text(encoding="utf-8")
    assert_true("detectTextLikeRegions" not in route, "route calls text-band detection")
    assert_true("/api/ocr/recognize" in owner, "owner is not bound")
    assert_true("cli_discovery" not in backend, "PATH discovery remains the product runtime")
    assert_true("shutil.which" not in backend, "PATH lookup remains")
    wasm = json.loads((ROOT / "apps/web/public/spe_wasm.sha256.json").read_text(encoding="utf-8"))
    assert_true(
        wasm["sha256"] == "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b",
        wasm["sha256"],
    )


def test_missing_binary_without_fetch() -> None:
    with tempfile.TemporaryDirectory() as raw:
        directory = Path(raw)
        copy_manifest(directory)
        model = directory / "tessdata" / "eng.traineddata"
        model.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "ocr-pack/tessdata/eng.traineddata", model)
        try:
            discover_qualified_assets(directory, fetch=False)
        except IntegrityError as exc:
            assert_true(exc.code.startswith("MISSING_BINARY "), exc.code)
            assert_true(PINNED_CLI_BLOB_SHA256 in exc.code, exc.code)
            assert_true(str(PINNED_CLI_BYTES) in exc.code, exc.code)
        else:
            fail("missing pinned CLI was accepted")


def _assert_stamp(execution_mode: str) -> dict:
    verdict = product_verdict()
    assert_true(verdict["OCR_PRODUCT"] == "HOLD", str(verdict))
    assert_true(verdict["OCR_PRODUCT"] != "PASS", str(verdict))
    assert_true(verdict["execution"] == execution_mode, str(verdict))
    assert_true(verdict["missing"] == "RELEASE_NOT_QUALIFIED", str(verdict))
    return verdict


def test_loopback_route(blob: bytes, phrase_span: str) -> None:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT)
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [sys.executable, "-m", "spe_runtime.ocr_product.route_host"],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.stdout is not None
    line = proc.stdout.readline()
    try:
        assert_true(line.startswith("OCR_HOST "), line)
        port = int(line.split()[1])
        request = urllib.request.Request(
            f"http://127.0.0.1:{port}/recognize",
            data=blob,
            method="POST",
            headers={"content-type": "application/octet-stream"},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
        assert_true(body["mode"] == "LOCAL_OCR", str(body))
        assert_true(body["egressAttempts"] == 0, str(body))
        assert_true(phrase_span in body["text"], body["text"])
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=30) as response:
            health = json.loads(response.read().decode("utf-8"))
        assert_true(health["OCR_PRODUCT"] == "HOLD", str(health))
        assert_true(health["OCR_PRODUCT"] != "PASS", str(health))
        assert_true(health["imageEgressAttempts"] == 0, str(health))
        print("OCR_ROUTE", json.dumps({"portHost": "127.0.0.1", "PRODUCT_STAMP": health["OCR_PRODUCT"], "execution": health.get("execution")}))
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def main() -> None:
    test_sources_do_not_embed_the_proof()
    test_rejects()
    model = ROOT / "ocr-pack/tessdata/eng.traineddata"
    cli = ROOT / "ocr-pack/tesseract"
    lib_dir = ROOT / "ocr-pack/lib"
    park = Path(f"/tmp/r6-ocr-absence-{os.getpid()}")
    if park.exists():
        shutil.rmtree(park)
    park.mkdir()
    try:
        _park(model, park / "eng.traineddata")
        _park(cli, park / "tesseract")
        _park(lib_dir, park / "lib")
        assert_true(not model.exists(), "model was not absent")
        assert_true(not cli.exists(), "cli was not absent")
        assert_true(not lib_dir.exists(), "cli library directory was not absent")
        reset_journey_for_tests()
        resting = product_verdict()
        assert_true(resting["OCR_PRODUCT"] == "HOLD", str(resting))
        assert_true(resting["execution"] == "NOT_RUN", str(resting))
        assets = discover_qualified_assets(fetch=True)
        assert_true(assets.model_acquired is True, "model fetch did not acquire")
        assert_true(assets.cli_acquired is True, "cli fetch did not acquire")
        assert_true(assets.model_path.stat().st_size == PINNED_MODEL_BYTES, "model size")
        assert_true(assets.cli_path == assets.root / "tesseract", str(assets.cli_path))
        assert_true("Cellar" not in str(assets.cli_path), str(assets.cli_path))
        assert_true(assets.cli_path.stat().st_size == PINNED_CLI_BYTES, "cli size")
        assert_true(hashlib.sha256(assets.cli_path.read_bytes()).hexdigest() == PINNED_CLI_SHA256, "cli digest")
        for relative in ("tesseract", "lib/libtesseract.5.dylib", "lib/libleptonica.6.dylib", "lib/libarchive.13.dylib"):
            _assert_closed_loads(assets.root / relative)
        manifest = json.loads((ROOT / "ocr-pack/PACK_MANIFEST.json").read_text(encoding="utf-8"))
        licensed = {item["formula"]: item["license"] for item in manifest["RUNTIME_COMPATIBILITY"]["vendored_libraries"]}
        assert_true(licensed["leptonica"] == "BSD-2-Clause", licensed["leptonica"])
        assert_true(licensed["libarchive"] == "BSD-2-Clause", licensed["libarchive"])
        hosts = model_ingress_hosts()
        assert_true(any(host in hosts for host in ("github.com", "raw.githubusercontent.com")), str(hosts))
        assert_true(cli_ingress_hosts(), str(cli_ingress_hosts()))
        blob = _recognize(PROOF)
        execution = LocalOcrSession.open(assets).recognize(blob)
        assert_true(execution.mode == "LOCAL_OCR", execution.mode + str(execution.error_code))
        assert_true(execution.egress_attempts == 0, str(execution.network_hosts))
        assert_true("HOLDFAST" in execution.text, execution.text)
        verdict = _assert_stamp("LOCAL_OCR")
        print("ABSENCE_THEN_ACQUIRE", json.dumps({
            "modelAbsentAtStart": True,
            "modelAcquired": assets.model_acquired,
            "modelIngressHosts": hosts,
            "cliAcquired": assets.cli_acquired,
            "cliIngressHosts": cli_ingress_hosts(),
            "cliPath": "ocr-pack/tesseract",
            "cliSha256": PINNED_CLI_SHA256,
            "cliBytes": PINNED_CLI_BYTES,
            "cliBlobSha256": PINNED_CLI_BLOB_SHA256,
        }))
        print("PRODUCT_STAMP", verdict["OCR_PRODUCT"])
        print("TRANSCRIPT", json.dumps({"span": "HOLDFAST", "text": execution.text}))

        _park(model, park / "eng-second.traineddata")
        assert_true(not model.exists(), "second image did not start with the model absent")
        second_assets = discover_qualified_assets(fetch=True)
        assert_true(second_assets.model_acquired is True, "second acquire did not download")
        assert_true(second_assets.cli_acquired is False, "second run rebuilt the CLI")
        second_blob = _recognize(SECOND)
        second = LocalOcrSession.open(second_assets).recognize(second_blob)
        assert_true(second.mode == "LOCAL_OCR", second.mode + str(second.error_code))
        assert_true("DOCK" in second.text, second.text)
        assert_true("HOLDFAST" not in second.text, second.text)
        assert_true(second.egress_attempts == 0, str(second.network_hosts))
        _assert_stamp("LOCAL_OCR")
        print("SECOND_IMAGE", json.dumps({
            "modelAbsentAtStart": True,
            "modelAcquired": True,
            "span": "DOCK",
            "text": second.text,
            "PRODUCT_STAMP": "HOLD",
        }))
        test_missing_binary_without_fetch()
        test_loopback_route(second_blob, "DOCK")
    finally:
        _restore(park / "eng.traineddata", model)
        _restore(park / "eng-second.traineddata", model)
        _restore(park / "tesseract", cli)
        _restore(park / "lib", lib_dir)
        shutil.rmtree(park, ignore_errors=True)
    print("OK r6 ocr")


if __name__ == "__main__":
    main()
