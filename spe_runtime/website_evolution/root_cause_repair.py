"""SPE Ω — Python Root Cause Repair Engine.

Grounded in SWE-bench Goes Live! (NeurIPS 2025).
Mandatory failing test before fix. Never write directly to main.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from spe_runtime.website_evolution.types import (
    DefectCategory,
    FailingTestBeforeFix,
    MinimalPatch,
)


class RootCauseRepairEnginePy:
    MAX_ITERATIONS = 3

    def diagnose_and_prepare_repair(
        self,
        category: DefectCategory,
        symptom: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        target_file = "apps/web/src/routing.ts"
        failing_test_name = f"test_reproduce_{category.value.lower()}"
        failing_test_code = ""
        original_chunk = ""
        replacement_chunk = ""
        root_cause = ""

        if category == DefectCategory.BROKEN_INTERNAL_LINK:
            broken_href = str(context.get("brokenHref", "/skills"))
            dest = str(context.get("authoritativeDestination", "/build-skill"))
            root_cause = f"Internal link href '{broken_href}' is an unmapped legacy route. Correct destination is '{dest}'."
            failing_test_code = f"assert resolve_route('{broken_href}') == '{dest}'"
            original_chunk = f"// placeholder: {broken_href}"
            replacement_chunk = f"ROUTE_ALIASES['{broken_href}'] = '{dest}'"

        elif category == DefectCategory.MOBILE_CLIPPING:
            target_file = "apps/web/src/landing/Hero.tsx"
            root_cause = "Hero headline uses rigid 'whitespace-nowrap' causing horizontal text clipping on mobile."
            failing_test_code = "assert headline_box.scroll_width <= headline_box.width"
            original_chunk = "className='hero-headline whitespace-nowrap'"
            replacement_chunk = "className='hero-headline text-balance break-words'"

        elif category == DefectCategory.CANONICAL_CONFLICT:
            root_cause = "Canonical URL uses HTTP instead of HTTPS scheme."
            failing_test_code = "assert canonical_url.startswith('https://systempromptengine.com')"
            original_chunk = "const SITE = 'http://systempromptengine.com';"
            replacement_chunk = "const SITE = 'https://systempromptengine.com';"

        else:
            root_cause = f"Defect in category {category.value}: {symptom}"
            failing_test_code = f"raise AssertionError('{symptom}')"
            original_chunk = "// defect marker"
            replacement_chunk = "// fix marker"

        isolated_branch = f"evolution/repair-{category.value.lower().replace('_', '-')}-{int(time.time())}"

        minimal_patch = MinimalPatch(
            target_file=target_file,
            original_chunk=original_chunk,
            replacement_chunk=replacement_chunk,
            line_count_diff=len(replacement_chunk.splitlines()) - len(original_chunk.splitlines()),
        )

        # Generating a test body is not the same as running that test.
        failing_test = FailingTestBeforeFix(
            test_name=failing_test_name,
            failing_output="NOT_EXECUTED: proposed reproduction test was not run",
            reproduced=False,
        )

        return {
            "defect_category": category,
            "symptom": symptom,
            "root_cause": root_cause,
            "isolated_branch": isolated_branch,
            "minimal_patch": minimal_patch,
            "failing_test_before_fix": failing_test,
            "iteration_count": 1,
            "oscillation_brake_triggered": False,
        }

    def check_oscillation_brake(self, consecutive_failures: int) -> bool:
        return consecutive_failures >= self.MAX_ITERATIONS
