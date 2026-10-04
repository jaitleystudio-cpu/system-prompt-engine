"""P0-1 OCR: pinned Tesseract, not a second engine and not a fixture echo."""

from __future__ import annotations

import json
import os
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
    PINNED_CLI_BYTES,
    PINNED_CLI_SHA256,
    PINNED_MODEL_BYTES,
    PINNED_MODEL_SHA256,
    discover_qualified_assets,
    ingress_hosts,
    product_verdict,
    reset_journey_for_tests,
)

PROOF = "SPE OCR LANE R6 HOLDFAST"
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


def test_missing_binary() -> None:
    try:
        discover_qualified_assets(fetch=True, environ={"PATH": ""})
    except IntegrityError as exc:
        assert_true(exc.code.startswith("MISSING_BINARY "), exc.code)
        assert_true(PINNED_CLI_SHA256 in exc.code, exc.code)
        assert_true(str(PINNED_CLI_BYTES) in exc.code, exc.code)
    else:
        fail("missing binary was accepted")


def render_proof(path: Path) -> None:
    program = """
import AppKit
let text = %s
let out = %s
let width = 1100
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
""" % (json.dumps(PROOF), json.dumps(str(path)))
    completed = subprocess.run(["swift", "-"], input=program, text=True, capture_output=True, check=False)
    if completed.returncode != 0 or not path.is_file():
        fail("could not render proof image: " + completed.stderr[-500:])


def test_execution() -> None:
    reset_journey_for_tests()
    before = product_verdict()
    assert_true(before["OCR_PRODUCT"] == "HOLD", str(before))
    assert_true(before["missing"] == "RECOGNITION_NOT_RUN", str(before))
    assets = discover_qualified_assets(fetch=True)
    assert_true(assets.model_path.stat().st_size == PINNED_MODEL_BYTES, "model size")
    session_dir = assets.root / ".session"
    session_dir.mkdir(parents=True, exist_ok=True)
    image = session_dir / "generated-proof.png"
    render_proof(image)
    blob = image.read_bytes()
    image.unlink()
    execution = LocalOcrSession.open(assets).recognize(blob)
    assert_true(execution.mode == "LOCAL_OCR", execution.mode + str(execution.error_code))
    assert_true(execution.egress_attempts == 0, str(execution.network_hosts))
    assert_true("HOLDFAST" in execution.text, execution.text)
    assert_true(any(region["text"] == "HOLDFAST" for region in execution.regions), str(execution.regions))
    verdict = product_verdict()
    assert_true(verdict["OCR_PRODUCT"] == "PASS", str(verdict))
    assert_true(verdict["missing"] is None, str(verdict))
    print("OCR_EXECUTION", json.dumps({
        "mode": execution.mode,
        "text": execution.text,
        "span": "HOLDFAST",
        "source": "swift-rendered png, phrase only in this test",
        "egress": execution.egress_attempts,
        "imageHosts": execution.network_hosts,
        "ingressHosts": ingress_hosts(),
        "modelSha256": PINNED_MODEL_SHA256,
        "modelBytes": PINNED_MODEL_BYTES,
        "verdict": verdict["OCR_PRODUCT"],
    }))


def test_loopback_route(blob: bytes) -> None:
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
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
        assert_true(body["mode"] == "LOCAL_OCR", str(body))
        assert_true(body["egressAttempts"] == 0, str(body))
        assert_true("HOLDFAST" in body["text"], body["text"])
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=30) as response:
            health = json.loads(response.read().decode("utf-8"))
        assert_true(health["OCR_PRODUCT"] == "PASS", str(health))
        assert_true(health["imageEgressAttempts"] == 0, str(health))
        print("OCR_ROUTE", json.dumps({"portHost": "127.0.0.1", "health": health["OCR_PRODUCT"], "ingress": health["ingressHosts"]}))
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def test_sources_do_not_embed_the_proof() -> None:
    for path in RUNTIME_FILES:
        text = path.read_text(encoding="utf-8")
        assert_true("HOLDFAST" not in text, str(path))
        assert_true("/Volumes/" not in text, str(path))
        assert_true("spe-worktrees" not in text, str(path))
        assert_true("OCR_PRODUCT=PASS" not in text, str(path))
    route = (ROOT / "apps/web/src/media/OcrRoute.tsx").read_text(encoding="utf-8")
    owner = (ROOT / "apps/web/src/media/ocrLite.ts").read_text(encoding="utf-8")
    assert_true("detectTextLikeRegions" not in route, "route calls text-band detection")
    assert_true("/api/ocr/recognize" in owner, "owner is not bound")
    wasm = json.loads((ROOT / "apps/web/public/spe_wasm.sha256.json").read_text(encoding="utf-8"))
    assert_true(
        wasm["sha256"] == "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b",
        wasm["sha256"],
    )


def main() -> None:
    test_sources_do_not_embed_the_proof()
    test_rejects()
    test_missing_binary()
    test_execution()
    # Re-render is inside test_execution and the file is deleted. Render once more for HTTP.
    session = ROOT / "ocr-pack/.session"
    session.mkdir(parents=True, exist_ok=True)
    image = session / "generated-proof.png"
    render_proof(image)
    blob = image.read_bytes()
    image.unlink()
    test_loopback_route(blob)
    print("PASS r6 ocr")


if __name__ == "__main__":
    main()
