"""
Test suite for SPE Ω Mission-Fit Skill Matcher & Permission Gateway (Master Prompt 2).
Verifies:
1. Constitutional Selection Law 1: CONSTITUTIONAL ATTESTATION (permission boundaries).
2. Constitutional Selection Law 2: CONFLICT CLOSURE (inter-skill operational conflicts).
3. Constitutional Selection Law 3: HONEST ABSTENTION (NO_QUALIFIED_MATCH_FOUND).
4. Task Requirements AST compilation and Master Prompt 2 recommendation emission.
"""

import pytest

from spe_runtime.research.exchange.mission_matcher import (
    InterSkillConflictError,
    MissionMatcher,
    MissionMatchResult,
    PermissionViolationError,
    SkillRecommendation,
    TaskRequirementsAST,
)


def test_task_ast_compilation_from_natural_language():
    """Verifies natural language intent parsing into structured AST."""
    intent = "Build Next.js App Router database migrations using Drizzle ORM, local only, air-gap"
    ast = TaskRequirementsAST.compile_from_text(intent)

    assert "Next.js App Router" in ast.required_capabilities
    assert "Drizzle ORM" in ast.required_capabilities
    assert "Database Migrations" in ast.required_capabilities
    assert "NETWORK" in ast.forbidden_permissions
    assert "EXTERNAL_EGRESS" in ast.forbidden_permissions
    assert "LOCAL_AST_ONLY" in ast.allowed_permissions


def test_permission_boundary_enforcement():
    """
    Constitutional Selection Law 1: CONSTITUTIONAL ATTESTATION.
    A skill combination must NEVER request permissions that violate master policy.
    """
    ast = TaskRequirementsAST(
        task_summary="Local code audit",
        required_capabilities=["Security Audit"],
        forbidden_permissions={"NETWORK", "CREDENTIALS"},
        allowed_permissions={"FILESYSTEM_SCOPED_READ", "LOCAL_AST_ONLY"},
    )

    # Permitted skill
    safe_perms = ["FILESYSTEM_SCOPED_READ", "LOCAL_AST_ONLY"]
    valid, violations = MissionMatcher.check_permission_boundary(safe_perms, ast)
    assert valid is True
    assert len(violations) == 0

    # Skill requesting forbidden NETWORK
    network_perms = ["FILESYSTEM_SCOPED_READ", "NETWORK"]
    valid, violations = MissionMatcher.check_permission_boundary(network_perms, ast)
    assert valid is False
    assert any("forbidden" in v.lower() and "network" in v.lower() for v in violations)

    # Skill requesting permission outside allowed ceiling
    write_perms = ["FILESYSTEM_SCOPED_WRITE"]
    valid, violations = MissionMatcher.check_permission_boundary(write_perms, ast)
    assert valid is False
    assert any("ceiling" in v.lower() or "outside" in v.lower() for v in violations)


def test_inter_skill_conflict_detection():
    """
    Constitutional Selection Law 2: CONFLICT CLOSURE.
    Detects competing authority domains and overlapping file write locks.
    """
    rec_drizzle = SkillRecommendation(
        rank=1,
        skill_identifier="@skill/drizzle-orm",
        task_fit_pct=95,
        wilson_score_pct=92.4,
        trials_n=200,
        required_permissions=["LOCAL_AST_ONLY"],
        limitation_or_tradeoff="Requires explicit schema",
        authority_domain="database_migration",
        scoped_write_paths=["drizzle/migrations/0001.sql"],
    )

    # Competing migration handler
    rec_prisma = SkillRecommendation(
        rank=2,
        skill_identifier="@skill/prisma-orm",
        task_fit_pct=90,
        wilson_score_pct=89.0,
        trials_n=150,
        required_permissions=["LOCAL_AST_ONLY"],
        limitation_or_tradeoff="Schema lock required",
        authority_domain="database_migration",  # Collision!
        scoped_write_paths=["prisma/schema.prisma"],
    )

    # Path write-lock collision
    rec_conflict_path = SkillRecommendation(
        rank=3,
        skill_identifier="@skill/custom-sql-generator",
        task_fit_pct=80,
        wilson_score_pct=85.0,
        trials_n=80,
        required_permissions=["FILESYSTEM_SCOPED_WRITE"],
        limitation_or_tradeoff="Manual review",
        authority_domain="sql_generation",
        scoped_write_paths=["drizzle/migrations/0001.sql"],  # Path collision!
    )

    # Non-conflicting frontend router
    rec_nextjs = SkillRecommendation(
        rank=2,
        skill_identifier="@skill/nextjs-router",
        task_fit_pct=90,
        wilson_score_pct=88.5,
        trials_n=120,
        required_permissions=["FILESYSTEM_SCOPED_WRITE"],
        limitation_or_tradeoff="Manual config check",
        authority_domain="frontend_routing",
        scoped_write_paths=["app/page.tsx"],
    )

    # 1. Authority collision detection
    passed, conflicts = MissionMatcher.detect_inter_skill_conflicts([rec_drizzle, rec_prisma])
    assert passed is False
    assert any("database_migration" in c for c in conflicts)

    # 2. Write path collision detection
    passed, conflicts = MissionMatcher.detect_inter_skill_conflicts([rec_drizzle, rec_conflict_path])
    assert passed is False
    assert any("drizzle/migrations/0001.sql" in c for c in conflicts)

    # 3. Compatible combination succeeds
    passed, conflicts = MissionMatcher.detect_inter_skill_conflicts([rec_drizzle, rec_nextjs])
    assert passed is True
    assert len(conflicts) == 0


def test_honest_abstention_when_no_match_possible():
    """
    Constitutional Selection Law 3: HONEST ABSTENTION.
    If no qualified skill exists that satisfies constraints, emits NO_QUALIFIED_MATCH_FOUND.
    """
    # Only skills requiring NETWORK
    catalog = [
        {
            "name": "@skill/cloud-uploader",
            "permissions": ["NETWORK", "EXTERNAL_EGRESS"],
            "capabilities": ["Cloud Upload"],
            "validity_window": {"status": "CURRENT"},
            "tested_environment": {"trials_n": 100},
            "performance_metrics": {"wilson_lower_bound_95": 0.95},
        }
    ]

    # Mission with strict offline ceiling
    res = MissionMatcher.match_mission(
        mission_input="Air-gapped upload without network",
        catalog=catalog,
        forbidden_permissions=["NETWORK", "EXTERNAL_EGRESS"],
        allowed_permissions=["LOCAL_AST_ONLY"],
    )

    assert res.status == "NO_QUALIFIED_MATCH_FOUND"
    assert len(res.recommendations) == 0
    assert "NO_QUALIFIED_MATCH_FOUND" in res.raw_markdown


def test_full_mission_match_workflow_emission():
    """Verifies complete emission of Master Prompt 2 Markdown table and command."""
    catalog = [
        {
            "name": "@skill/drizzle-orm",
            "capabilities": ["Drizzle ORM", "Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "authority_domain": "database_migration",
            "limitation": "Requires explicit schema input",
            "tested_environment": {"trials_n": 200},
            "performance_metrics": {"wilson_lower_bound_95": 0.942},
            "validity_window": {"status": "CURRENT"},
        },
        {
            "name": "@skill/nextjs-router",
            "capabilities": ["Next.js App Router"],
            "permissions": ["FILESYSTEM_SCOPED_WRITE"],
            "authority_domain": "frontend_routing",
            "limitation": "Manual config file review needed",
            "tested_environment": {"trials_n": 120},
            "performance_metrics": {"wilson_lower_bound_95": 0.895},
            "validity_window": {"status": "CURRENT"},
        },
        {
            "name": "@skill/security-auditor",
            "capabilities": ["Security Audit"],
            "permissions": ["FILESYSTEM_SCOPED_READ"],
            "authority_domain": "security_audit",
            "limitation": "Read-only analysis; cannot auto-fix",
            "tested_environment": {"trials_n": 85},
            "performance_metrics": {"wilson_lower_bound_95": 0.861},
            "validity_window": {"status": "CURRENT"},
        },
    ]

    res = MissionMatcher.match_mission(
        mission_input="Build database migrations with Next.js App Router, offline local AST only",
        catalog=catalog,
        runtime="Cursor",
    )

    assert res.status == "QUALIFIED_MATCH"
    assert len(res.recommendations) == 3
    assert res.conflict_check_passed is True
    assert 'spe continue --skills' in res.suggested_command

    # Check Markdown table structure
    md = res.raw_markdown
    assert "### 🎯 SPE MISSION-FIT RECOMMENDATION" in md
    assert "| Rank | Recommended Skill | Task Fit | Wilson Score | Required Permissions | Limitation / Trade-off |" in md
    assert "| **#1** | `@skill/drizzle-orm`" in md
    assert "### 🛡️ COMBINED SAFETY AUDIT:" in md
    assert "Multi-skill conflict check: PASSED" in md


def test_canonical_evidence_passport_permission_footprint_matching():
    """
    Verifies that Master Prompt 1 canonical permission assertions
    (['FILESYSTEM_SCOPED_READ', 'NO_NETWORK', 'NO_CREDENTIALS']) correctly pass
    the permission gateway for offline/air-gapped missions.
    """
    from spe_runtime.research.exchange.merit_ranker import MeritRanker

    passport = MeritRanker.generate_evidence_passport(
        target_identifier="@skill/safe-offline-engine",
        version_digest="sha256:safe99",
        trials_n=200,
        successes=195,
        permission_footprint=["FILESYSTEM_SCOPED_READ", "NO_NETWORK", "NO_CREDENTIALS"],
    )

    ast = TaskRequirementsAST.compile_from_text("Perform offline security audit, air-gap")
    valid, violations = MissionMatcher.check_permission_boundary(passport.security_audit.permission_footprint, ast)
    assert valid is True
    assert len(violations) == 0

    # Ensure match_mission succeeds with EvidencePassport objects
    res = MissionMatcher.match_mission(
        mission_input=ast,
        catalog=[passport],
    )
    assert res.status == "QUALIFIED_MATCH"
    assert len(res.recommendations) == 1
    assert res.recommendations[0].skill_identifier == "@skill/safe-offline-engine"


def test_commercial_isolation_in_mission_matching():
    """
    Constitutional Selection Law: ZERO RANKING INFLUENCE FROM CAPITAL.
    Sponsored skills (even with highest bid and high task fit) must NEVER infiltrate
    organic Top-3 mission recommendations.
    """
    catalog = [
        {
            "name": "@skill/sponsored-heavy",
            "capabilities": ["Drizzle ORM", "Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "is_sponsored": True,
            "sponsor_bid_usd": 5000.0,
            "validity_window": {"status": "CURRENT"},
            "tested_environment": {"trials_n": 100},
            "performance_metrics": {"wilson_lower_bound_95": 0.98},
        },
        {
            "name": "@skill/organic-drizzle",
            "capabilities": ["Drizzle ORM", "Database Migrations"],
            "permissions": ["LOCAL_AST_ONLY"],
            "is_sponsored": False,
            "sponsor_bid_usd": 0.0,
            "validity_window": {"status": "CURRENT"},
            "tested_environment": {"trials_n": 100},
            "performance_metrics": {"wilson_lower_bound_95": 0.92},
        },
    ]

    res = MissionMatcher.match_mission("Build Drizzle database migrations", catalog)
    assert res.status == "QUALIFIED_MATCH"
    assert len(res.recommendations) == 1
    assert res.recommendations[0].skill_identifier == "@skill/organic-drizzle"
    # Sponsored skill must NOT be in organic recommendations
    rec_names = [r.skill_identifier for r in res.recommendations]
    assert "@skill/sponsored-heavy" not in rec_names


def test_glob_and_directory_write_lock_conflicts():
    """
    Verifies that fnmatch globs and parent-directory containment write locks
    are recognized as operational conflicts.
    """
    rec_wildcard = SkillRecommendation(
        rank=1,
        skill_identifier="@skill/wildcard-writer",
        task_fit_pct=90,
        wilson_score_pct=90.0,
        trials_n=100,
        required_permissions=["FILESYSTEM_SCOPED_WRITE"],
        limitation_or_tradeoff="None",
        authority_domain="frontend",
        scoped_write_paths=["app/*"],
    )

    rec_concrete = SkillRecommendation(
        rank=2,
        skill_identifier="@skill/concrete-writer",
        task_fit_pct=85,
        wilson_score_pct=88.0,
        trials_n=100,
        required_permissions=["FILESYSTEM_SCOPED_WRITE"],
        limitation_or_tradeoff="None",
        authority_domain="backend",  # Different domain, but conflicting file!
        scoped_write_paths=["app/page.tsx"],
    )

    passed, conflicts = MissionMatcher.detect_inter_skill_conflicts([rec_wildcard, rec_concrete])
    assert passed is False
    assert len(conflicts) > 0
    assert any("Overlapping write lock" in c for c in conflicts)

