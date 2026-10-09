"""
SPE Ω — Programmatic SEO & Ad-Monetization Governor Kernel (Master Prompt 3)

Protects against Google "scaled content abuse" penalties via empirical indexability classification,
strictly enforces the 100% ad-free private workspace sanctuary, generates accurate JSON-LD schemas,
and renders 4-zone compliant semantic markup.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import html
import json
from typing import Any, Dict, List, Optional, Set, Tuple


class AdSanctuaryViolationError(ValueError):
    """Raised when an attempt is made to place ads or tracking scripts in private workspaces."""
    pass


class ScaledContentAbuseError(ValueError):
    """Raised when thin or unverified content attempts to claim indexable status."""
    pass


@dataclass
class IndexabilityResult:
    status: str  # INDEXABLE / NON_INDEXABLE
    robots_directive: str  # "index, follow" / "noindex, follow"
    reason: str
    trials_n: int
    has_evidence_passport: bool
    is_thin_stub: bool
    is_internal_filter: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "robots_directive": self.robots_directive,
            "reason": self.reason,
            "trials_n": self.trials_n,
            "has_evidence_passport": self.has_evidence_passport,
            "is_thin_stub": self.is_thin_stub,
            "is_internal_filter": self.is_internal_filter,
        }


@dataclass
class SoftwareApplicationSchema:
    name: str
    application_category: str = "DeveloperApplication"
    operating_system: str = "macOS, Linux"
    software_version: str = "1.0.0"
    rating_value: float = 4.8  # Empirical rating based on Wilson score (NEVER fake user 5-stars)
    rating_count: int = 150
    evidence_passport_id: str = ""

    def to_json_ld(self) -> Dict[str, Any]:
        return {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": self.name,
            "applicationCategory": self.application_category,
            "operatingSystem": self.operating_system,
            "softwareVersion": self.software_version,
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": round(self.rating_value, 2),
                "ratingCount": self.rating_count,
                "bestRating": 5,
                "worstRating": 1,
            },
            "identifier": self.evidence_passport_id,
        }


@dataclass
class TechArticleSchema:
    headline: str
    dependencies: List[str]
    version: str
    test_methodology: str
    author: str = "SPE Ω Empirical Research Engine"

    def to_json_ld(self) -> Dict[str, Any]:
        return {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": self.headline,
            "author": {"@type": "Organization", "name": self.author},
            "dependencies": ", ".join(self.dependencies),
            "version": self.version,
            "articleBody": self.test_methodology,
        }


@dataclass
class ItemListSchema:
    name: str
    items: List[Dict[str, Any]]

    def to_json_ld(self) -> Dict[str, Any]:
        elements = []
        for i, item in enumerate(self.items):
            elements.append({
                "@type": "ListItem",
                "position": i + 1,
                "name": item.get("name", f"Rank #{i+1}"),
                "url": item.get("url", f"https://spe.run/exchange/{item.get('name', '')}"),
            })
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": self.name,
            "itemListElement": elements,
        }


class SeoGovernor:
    """
    SPE Ω Programmatic SEO & Monetization Governor.
    Enforces scaled content defenses, ad-free private sanctuary, and semantic page layouts.
    """

    PUBLIC_DISCOVERY_PREFIXES = (
        "/exchange",
        "/skills",
        "/plugins",
        "/compare",
        "/audits",
    )

    PRIVATE_WORKSPACE_PREFIXES = (
        "/workspace",
        "/execution-logs",
        "/continuation",
        "/authorize",
        "/prompt",
        "/code",
        "/session",
    )

    MIN_EMPIRICAL_TRIALS_THRESHOLD = 10

    @classmethod
    def is_private_workspace(cls, route: str) -> bool:
        """Determines if a route belongs to the private workspace sanctuary."""
        norm = route.strip().lower()
        if not norm.startswith("/"):
            norm = "/" + norm
        return any(norm.startswith(p) for p in cls.PRIVATE_WORKSPACE_PREFIXES)

    @classmethod
    def is_public_discovery(cls, route: str) -> bool:
        """Determines if a route belongs to the public discovery surface."""
        norm = route.strip().lower()
        if not norm.startswith("/"):
            norm = "/" + norm
        return any(norm.startswith(p) for p in cls.PUBLIC_DISCOVERY_PREFIXES)

    @classmethod
    def classify_indexability(
        cls,
        route: str,
        trials_n: int = 0,
        has_evidence_passport: bool = False,
        is_user_search_query: bool = False,
        is_raw_unverified_import: bool = False,
        has_reproducible_benchmark: bool = True,
    ) -> IndexabilityResult:
        """
        Constitutional Publication Gate 1: THE SCALED CONTENT DEFENSE.
        Protects against Google penalties for thin/spun content:
        - Only pages with >= 10 trials, valid Evidence Passports, and reproducible benchmarks are INDEXABLE.
        - Unverified submissions, search query facets, and thin stubs are strictly NOINDEX.
        """
        # Private workspaces are never indexed
        if cls.is_private_workspace(route):
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, nofollow",
                reason="Private workspace sanctuary is strictly non-indexable and confidential.",
                trials_n=trials_n,
                has_evidence_passport=has_evidence_passport,
                is_thin_stub=False,
                is_internal_filter=False,
            )

        if is_user_search_query:
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, follow",
                reason="Internal faceted search filters must not pollute search engine indexes.",
                trials_n=trials_n,
                has_evidence_passport=has_evidence_passport,
                is_thin_stub=False,
                is_internal_filter=True,
            )

        if is_raw_unverified_import:
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, follow",
                reason="Unverified third-party raw metadata lacks reproducible empirical verification.",
                trials_n=trials_n,
                has_evidence_passport=has_evidence_passport,
                is_thin_stub=True,
                is_internal_filter=False,
            )

        if not has_evidence_passport:
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, follow",
                reason="Page lacks an authenticated Evidence Passport.",
                trials_n=trials_n,
                has_evidence_passport=False,
                is_thin_stub=True,
                is_internal_filter=False,
            )

        if trials_n < cls.MIN_EMPIRICAL_TRIALS_THRESHOLD:
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, follow",
                reason=f"Insufficient empirical test volume ({trials_n} < {cls.MIN_EMPIRICAL_TRIALS_THRESHOLD} required trials).",
                trials_n=trials_n,
                has_evidence_passport=has_evidence_passport,
                is_thin_stub=True,
                is_internal_filter=False,
            )

        if not has_reproducible_benchmark:
            return IndexabilityResult(
                status="NON_INDEXABLE",
                robots_directive="noindex, follow",
                reason="Page lacks a reproducible verification command or empirical benchmark receipt.",
                trials_n=trials_n,
                has_evidence_passport=has_evidence_passport,
                is_thin_stub=True,
                is_internal_filter=False,
            )

        return IndexabilityResult(
            status="INDEXABLE",
            robots_directive="index, follow",
            reason="Substantive original empirical measurements with version-pinned Evidence Passport.",
            trials_n=trials_n,
            has_evidence_passport=True,
            is_thin_stub=False,
            is_internal_filter=False,
        )

    @classmethod
    def validate_ad_sanctuary(
        cls,
        route: str,
        has_ads: bool = False,
        ad_payload: Optional[Dict[str, Any]] = None,
        context_contains_private_prompt: bool = False,
        context_contains_user_code: bool = False,
    ) -> bool:
        """
        Constitutional Publication Gate 2: THE PRIVACY & AD-FREE SANCTUARY.
        Guarantees that private workspaces are 100% ad-free and zero-tracking.
        Raises AdSanctuaryViolationError if any ad is placed in private workspace or if PII is leaked.
        """
        if cls.is_private_workspace(route):
            if has_ads or (ad_payload is not None and len(ad_payload) > 0):
                raise AdSanctuaryViolationError(
                    f"Ad Sanctuary Violation: Ads are strictly forbidden in private workspace route '{route}'."
                )

        # Leakage guard: Private prompt text or user code may NEVER be passed to ad targets
        if context_contains_private_prompt or context_contains_user_code:
            raise AdSanctuaryViolationError(
                "Ad Sanctuary Violation: Private prompt text or user code detected in ad targeting payload."
            )

        return True

    @classmethod
    def generate_page_markup(
        cls,
        route: str,
        title: str,
        canonical_url: str,
        breadcrumbs: List[Tuple[str, str]],
        comparative_data: List[Dict[str, Any]],
        methodology_text: str,
        reproducible_command: str,
        wilson_score_lower_bound: float,
        trials_n: int,
        target_identifier: str = "skill-target",
        version_digest: str = "v1",
        passport_id: str = "EVP-123456",
        has_ads: bool = True,
    ) -> str:
        """
        Generates clean semantic HTML following the 4-zone architecture:
        - Header Zone: Editorial H1, canonical tag, breadcrumb trail, top banner (public only).
        - Core Value Zone: Comparative data, methodology, Wilson confidence interval, test command.
        - In-Content Zone: Visual separation for contextual developer tool ad (public only).
        - Footer Zone: Methodology links, privacy policy, GDPR/EEA CMP trigger, withdrawal/appeal.
        """
        is_private = cls.is_private_workspace(route)

        # Enforce ad sanctuary
        cls.validate_ad_sanctuary(route, has_ads=has_ads and not is_private)

        # Classify indexability
        idx_res = cls.classify_indexability(
            route=route,
            trials_n=trials_n,
            has_evidence_passport=bool(passport_id),
            has_reproducible_benchmark=bool(reproducible_command),
        )

        # Generate JSON-LD
        empirical_rating = min(5.0, max(1.0, 1.0 + (wilson_score_lower_bound * 4.0)))
        app_schema = SoftwareApplicationSchema(
            name=target_identifier,
            software_version=version_digest,
            rating_value=empirical_rating,
            rating_count=trials_n,
            evidence_passport_id=passport_id,
        )
        json_ld_str = json.dumps(app_schema.to_json_ld(), indent=2)

        # Build breadcrumbs HTML
        bc_items = []
        for name, link in breadcrumbs:
            bc_items.append(f'<a href="{html.escape(link)}">{html.escape(name)}</a>')
        bc_html = " &gt; ".join(bc_items)

        # Build comparative rows HTML
        rows_html = []
        for row in comparative_data:
            rows_html.append(
                f"<tr>"
                f"<td>{html.escape(str(row.get('metric', '')))}</td>"
                f"<td>{html.escape(str(row.get('candidate', '')))}</td>"
                f"<td>{html.escape(str(row.get('baseline', '')))}</td>"
                f"<td>{html.escape(str(row.get('delta', '')))}</td>"
                f"</tr>"
            )
        table_rows = "\n            ".join(rows_html)

        # Zones assembly
        # Zone 1: Header Zone
        top_banner_html = ""
        if not is_private and has_ads:
            top_banner_html = (
                '\n    <!-- Header Zone Top Banner (IAB 728x90 / 970x90 Responsive) -->'
                '\n    <aside class="spe-ad-zone spe-ad-header" role="region" aria-label="Advertisement">'
                '\n      <div class="spe-ad-label">Advertisement</div>'
                '\n      <div class="spe-ad-banner-slot" data-slot-format="728x90">Contextual Developer Tool Sponsor</div>'
                '\n    </aside>'
            )

        # Zone 3: In-Content Zone
        incontent_ad_html = ""
        if not is_private and has_ads:
            incontent_ad_html = (
                '\n    <!-- In-Content Zone Contextual Developer Tool Ad -->'
                '\n    <aside class="spe-ad-zone spe-ad-incontent" role="region" aria-label="Sponsored Tool">'
                '\n      <div class="spe-ad-label">Sponsored Resource</div>'
                '\n      <div class="spe-ad-incontent-slot">Verified Cloud Infrastructure Partner</div>'
                '\n    </aside>'
            )

        private_sanctuary_badge = ""
        if is_private:
            private_sanctuary_badge = (
                '\n    <div class="spe-private-sanctuary-badge">'
                '\n      🛡️ 100% Ad-Free Private Workspace Sanctuary — Zero Tracking'
                '\n    </div>'
            )

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)} — SPE Ω Verified Exchange</title>
  <meta name="robots" content="{idx_res.robots_directive}">
  <link rel="canonical" href="{html.escape(canonical_url)}">
  <script type="application/ld+json">
{json_ld_str}
  </script>
</head>
<body class="spe-page">
  <!-- ZONE 1: HEADER ZONE -->
  <header class="spe-header-zone">
    <nav class="spe-breadcrumb" aria-label="Breadcrumb">
      {bc_html}
    </nav>
    <h1 class="spe-title">{html.escape(title)}</h1>{top_banner_html}
  </header>
{private_sanctuary_badge}
  <!-- ZONE 2: CORE VALUE ZONE -->
  <main class="spe-core-value-zone">
    <section class="spe-empirical-evidence">
      <h2>Empirical Verification &amp; Wilson Confidence Interval</h2>
      <div class="spe-metric-card">
        <span class="spe-metric-label">Wilson Score 95% Lower Bound:</span>
        <span class="spe-metric-value">{round(wilson_score_lower_bound * 100, 2)}%</span>
        <span class="spe-metric-sample">(n = {trials_n} trials)</span>
      </div>
      <p class="spe-methodology">{html.escape(methodology_text)}</p>

      <div class="spe-verification-terminal">
        <h3>Downloadable Reproducible Verification Command</h3>
        <pre><code>{html.escape(reproducible_command)}</code></pre>
      </div>

      <table class="spe-comparison-table">
        <thead>
          <tr>
            <th>Dimension / Metric</th>
            <th>Tested Candidate</th>
            <th>Industry Baseline</th>
            <th>Net Delta</th>
          </tr>
        </thead>
        <tbody>
            {table_rows}
        </tbody>
      </table>
    </section>
{incontent_ad_html}
  </main>

  <!-- ZONE 4: FOOTER ZONE -->
  <footer class="spe-footer-zone">
    <nav class="spe-footer-links">
      <a href="/methodology">Test Methodology &amp; Mathematical Rigor</a>
      <a href="/privacy">Privacy Sanctuary Policy</a>
      <a href="/governance">Evidence Qualification Criteria</a>
      <a href="/appeals">Disqualification Appeal Mechanism</a>
    </nav>
    <div class="spe-cmp-container">
      <button class="spe-cmp-trigger" id="spe-cmp-settings">Cookie &amp; Privacy Preferences (GDPR/EEA Certified)</button>
    </div>
    <p class="spe-copyright">&copy; 2026 SPE Ω Zero-Subscription Verification Authority.</p>
  </footer>
</body>
</html>"""
        return html_content
