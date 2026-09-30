"""Localization R1 qualification tests.

These wrap the donor-foundation oracles. A failure is preserved evidence.
Do not weaken an assertion to make a donor defect pass.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
ORACLE = ROOT / "qualification" / "localization_r1" / "oracle.mjs"
RUNNER = ROOT / "qualification" / "localization_r1" / "run_l10n1_mutations.py"

ORACLE_NAMES = [
    "unpublished_registered_locales_omitted",
    "published_localized_route_can_emit",
    "published_without_resolver_does_not_invent",
    "resolver_null_does_not_invent",
    "default_alternates_point_at_published_canonical",
    "canonical_en_emitted_when_published",
    "hreflang_tags_are_registered_or_xdefault",
    "hreflang_codes_are_unique",
    "publication_registry_is_published_en_only",
    "rtl_text_preserved_inside_isolate",
    "isolation_wraps_fsi_pdi",
    "isolation_uses_fsi_not_override",
    "ltr_neighbors_stay_outside_isolate",
    "exact_locale_identity_kept",
    "translated_catalog_kept",
    "missing_key_is_not_empty_string",
    "missing_key_is_not_english_gloss",
    "semantic_authority_not_elevated",
    "fallback_locale_id_is_registered",
    "language_is_not_country",
    "seo_head_uses_default_publication",
    "app_routes_have_no_localized_prefix",
    "bdi_isolate_does_not_set_page_ltr_to_rtl",
    "untranslated_locale_stays_marked",
    "empty_catalog_value_is_not_success",
    "locale_fallback_does_not_change_script_or_region",
    "bidi_override_not_accepted_as_content",
    "region_is_not_a_translation",
    "x_default_withheld_when_nothing_is_published",
    "x_default_target_is_a_published_locale_url",
]


@pytest.fixture(scope="module")
def oracle_report() -> dict[str, dict[str, object]]:
    env = os.environ.copy()
    env["L10N_REPO_ROOT"] = str(ROOT)
    completed = subprocess.run(
        ["node", "--experimental-strip-types", str(ORACLE)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr
    payload = json.loads(completed.stdout)
    assert "__error" not in payload, payload["__error"]
    assert list(payload) == ORACLE_NAMES
    return payload


@pytest.mark.parametrize("name", ORACLE_NAMES)
def test_localization_r1_obligation(name: str, oracle_report: dict[str, dict[str, object]]) -> None:
    row = oracle_report[name]
    failures = row["failures"]
    assert row["pass"] is True, "\n".join(str(item) for item in failures)  # type: ignore[arg-type]


def test_l10n1_mutant_catalog_defines_twenty() -> None:
    text = RUNNER.read_text(encoding="utf-8")
    for index in range(1, 21):
        assert f'"L10N1-{index:02d}"' in text
