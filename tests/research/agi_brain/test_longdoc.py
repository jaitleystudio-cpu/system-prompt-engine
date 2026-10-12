import json, os
import pytest
from spe_runtime.research.agi_brain.longdoc import LongDocJob, JobConfig, DeterministicTestGenerator, words

EV = {"contract_r1": "docs/agi-brain/CONTRACT_R1.md"}


def _job(tmp_path, gen, target=100_000, n=40):
    j = LongDocJob(str(tmp_path / "job"), gen, EV)
    j.create(JobConfig("Write a field guide to verified prompt engineering", target, n)); return j


def test_one_instruction_100k_words_single_export(tmp_path):
    st = _job(tmp_path, DeterministicTestGenerator()).run()
    assert st["stage"] == "exported"
    doc = (tmp_path / "job" / "export.md").read_text()
    assert abs(st["checks"]["total_words"] - 100_000) <= 2000
    assert doc.count("\n## ") == 40 and abs(words(doc) - 100_000) <= 2500


def test_resume_after_interruption_no_lost_or_duplicated_sections(tmp_path):
    j = _job(tmp_path, DeterministicTestGenerator(fail_after=13))
    with pytest.raises(RuntimeError): j.run()
    st = json.loads((tmp_path / "job" / "job.json").read_text())
    assert len(st["sections"]) == 13 and st["stage"] == "generated:13/40"
    before = {k: v["sha"] for k, v in st["sections"].items()}
    gen2 = DeterministicTestGenerator()
    st2 = LongDocJob(str(tmp_path / "job"), gen2, EV).run()
    assert gen2.calls == 27  # only the missing sections were generated
    assert st2["stage"] == "exported" and len(st2["sections"]) == 40
    assert all(st2["sections"][k]["sha"] == h for k, h in before.items())
    titles = [l for l in (tmp_path / "job" / "export.md").read_text().splitlines() if l.startswith("## ")]
    assert len(titles) == len(set(titles)) == 40


def test_crash_leaves_tmp_file_and_corrupt_section_is_regenerated(tmp_path):
    j = _job(tmp_path, DeterministicTestGenerator(fail_after=5), target=5000, n=10)
    with pytest.raises(RuntimeError): j.run()
    sec = tmp_path / "job" / "sections" / "0002.md"
    sec.write_text("tampered")
    (tmp_path / "job" / "sections" / "0005.md.tmp").write_text("half-written")
    gen2 = DeterministicTestGenerator()
    st = LongDocJob(str(tmp_path / "job"), gen2, EV).run()
    assert gen2.calls == 6 and st["stage"] == "exported"
    assert "tampered" not in (tmp_path / "job" / "export.md").read_text()


def test_word_count_drift_is_detected(tmp_path):
    st = _job(tmp_path, DeterministicTestGenerator(drift=0.3), target=10_000, n=10).run()
    assert st["stage"] == "checks_failed" and any("total words" in p for p in st["checks"]["problems"])
    assert not (tmp_path / "job" / "export.md").exists()


def test_claim_manifest_downgrades_unbacked_verified_claims(tmp_path):
    _job(tmp_path, DeterministicTestGenerator(), target=2000, n=4).run()
    m = json.loads((tmp_path / "job" / "manifest.json").read_text())
    assert m["claim_counts"] == {"verified": 4, "proposed": 4, "speculative": 4}
    assert all(c.get("evidence") in EV for c in m["claims"] if c["status"] == "verified")
    assert "Mechanics only" in m["quality_note"]


def test_job_dir_refuses_different_instruction(tmp_path):
    _job(tmp_path, DeterministicTestGenerator(), target=1000, n=2)
    with pytest.raises(ValueError):
        LongDocJob(str(tmp_path / "job"), DeterministicTestGenerator()).create(JobConfig("other", 1000, 2))
