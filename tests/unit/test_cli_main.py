"""Unit tests for spe_runtime.cli.main dispatcher."""

from pathlib import Path
from spe_runtime.cli.main import main


def test_cli_adopt_scan(tmp_path: Path):
    sample_file = tmp_path / "agent.py"
    sample_file.write_text('system_prompt = "You are a safe assistant. Always protect PII."\n', encoding="utf-8")
    
    code = main(["adopt", str(tmp_path), "--scan"])
    assert code == 0


def test_cli_check_strict(tmp_path: Path):
    clean_file = tmp_path / "prompt.md"
    clean_file.write_text(
        "You are an assistant. Strictly protect user privacy.\n"
        "Never leak confidential data or records.\n"
        "Always output valid JSON conforming to schema.\n"
        "Confirm before executing sensitive operations.\n",
        encoding="utf-8",
    )
    code = main(["check", str(clean_file), "--strict"])
    assert code == 0


def test_cli_bench():
    code = main(["bench"])
    assert code == 0


def test_cli_passport():
    code = main(["passport", "gpt-4o"])
    assert code == 0


def test_cli_failures():
    code = main(["failures"])
    assert code == 0


def test_cli_bisect():
    code = main(["bisect"])
    assert code == 0


def test_cli_pack_and_verify(tmp_path: Path):
    pkg_dir = tmp_path / "test_pkg"
    code = main(["pack", str(pkg_dir)])
    assert code == 0
    assert (pkg_dir / "manifest.json").exists()

    code_verify = main(["pack", str(pkg_dir), "--verify"])
    assert code_verify == 0


def test_cli_explain():
    code = main(["explain", "Ensure no financial records are leaked"])
    assert code == 0


def test_cli_seal(tmp_path: Path):
    prompt_file = tmp_path / "prompt.md"
    prompt_file.write_text("Strict financial privacy directive.", encoding="utf-8")
    out_receipt = tmp_path / "receipt.json"

    code = main(["seal", str(prompt_file), "--out", str(out_receipt)])
    assert code == 0
    assert out_receipt.exists()
    import json
    data = json.loads(out_receipt.read_text(encoding="utf-8"))
    assert "digest_sha256" in data
    assert "signature_ed25519" in data
    assert data["verified"] is True


def test_cli_sbom(tmp_path: Path):
    prompt_file = tmp_path / "prompt.md"
    prompt_file.write_text("System instructions for SQL query agent.", encoding="utf-8")
    out_sbom = tmp_path / "sbom.json"

    code = main(["sbom", str(prompt_file), "--out", str(out_sbom)])
    assert code == 0
    assert out_sbom.exists()
    import json
    data = json.loads(out_sbom.read_text(encoding="utf-8"))
    assert "sbom_id" in data
    assert "content_hash" in data


def test_cli_inspect(tmp_path: Path):
    pkg_dir = tmp_path / "inspect_pkg"
    main(["pack", str(pkg_dir)])

    code = main(["inspect", str(pkg_dir)])
    assert code == 0

