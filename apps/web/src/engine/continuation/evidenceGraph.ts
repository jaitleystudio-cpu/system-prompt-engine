/**
 * SPE Claim-Evidence Graph & Contradiction / Gap Mapper (Wave RT-C)
 *
 * Constructs a verifiable DAG connecting claims to empirical proof and specifications.
 * Identifies contradictory claims and unverified evidence gaps.
 *
 * Enforces Epistemic Invariants:
 * - RETRIEVED != SUPPORTS_CLAIM
 * - Executable contradiction outranks model prose.
 * - UNKNOWN != PASS
 */

import type {
  ClaimRecord,
  ScholarlySourceRecord,
  EvidenceEdge,
  ClaimEvidenceGraph,
  ContradictionFinding,
  EvidenceGap,
} from "./types";
import {
  assertLegalRelation,
  classifyClaimSourceRelation,
  downgradeDualSupport,
} from "./oracleGuards";

/**
 * Builds the Claim-Evidence Graph linking extracted claims with verified sources.
 */
export function buildClaimEvidenceGraph(
  claims: ClaimRecord[],
  sources: ScholarlySourceRecord[]
): ClaimEvidenceGraph {
  const claimsMap: Record<string, ClaimRecord> = {};
  const sourcesMap: Record<string, ScholarlySourceRecord> = {};
  const edges: EvidenceEdge[] = [];

  for (const claim of claims) {
    claimsMap[claim.claimId] = claim;
  }
  for (const source of sources) {
    sourcesMap[source.sourceId] = source;
  }

  // Link claims to relevant sources with fail-closed relation classifier.
  // Worker prose never creates SUPPORTS. Adjacent topics stay IRRELEVANT/PARTIAL.
  for (const claim of claims) {
    for (const src of sources) {
      const { relation, limitations } = classifyClaimSourceRelation(
        claim.claimText,
        src,
        claim.disposition,
      );
      if (relation === "IRRELEVANT" && limitations.includes("INSUFFICIENT_SUBJECT_OVERLAP")) {
        continue;
      }
      if (!assertLegalRelation(relation)) {
        throw new Error(`Illegal evidence relation: ${relation}`);
      }
      edges.push({
        edgeId: `EDGE-${claim.claimId}-${src.sourceId}`,
        claimId: claim.claimId,
        sourceId: src.sourceId,
        relation,
        locator: src.preciseLocator || undefined,
        limitations,
      });
    }
  }

  return {
    claims: claimsMap,
    sources: sourcesMap,
    edges: downgradeDualSupport(edges),
  };
}

/**
 * Generates structured Contradiction Map and Gap Map from claims and graph edges.
 */
export function mapContradictionsAndGaps(
  graph: ClaimEvidenceGraph
): {
  contradictions: ContradictionFinding[];
  gaps: EvidenceGap[];
  formattedGraphSummary: string;
} {
  const contradictions: ContradictionFinding[] = [];
  const gaps: EvidenceGap[] = [];

  for (const claim of Object.values(graph.claims)) {
    const claimEdges = graph.edges.filter((e) => e.claimId === claim.claimId);
    const hasSupport = claimEdges.some((e) => e.relation === "SUPPORTS");
    if (!hasSupport && claim.disposition !== "OUT_OF_SCOPE") {
      gaps.push({
        gapId: `GAP-NO-SUPPORT-${claim.claimId}`,
        claimId: claim.claimId,
        description: `Claim "${claim.claimText.slice(0, 50)}..." has no SUPPORTS edge; Gap Map must stay non-empty.`,
        missingProofType: claim.claimType === "PERFORMANCE" ? "BENCHMARK" : "SPECIFICATION",
      });
    }
  }

  for (const edge of graph.edges) {
    const claim = graph.claims[edge.claimId];
    const source = graph.sources[edge.sourceId];

    if (edge.relation === "CONTRADICTS") {
      contradictions.push({
        contradictionId: `CTRD-GRAPH-${edge.edgeId}`,
        claimId: edge.claimId,
        observedText: claim ? claim.claimText : "Unknown Claim",
        conflictingEvidence: source
          ? `${source.title} (${source.identifier}): ${source.keyFinding}`
          : "Normative specification violation",
        severity: "FATAL",
      });
    } else if (edge.relation === "PARTIAL" || edge.relation === "UNKNOWN") {
      gaps.push({
        gapId: `GAP-GRAPH-${edge.edgeId}`,
        claimId: edge.claimId,
        description: `Claim "${claim?.claimText.slice(0, 50)}..." requires empirical proof to satisfy ${source?.title}.`,
        missingProofType: "BENCHMARK",
      });
    }
  }

  // Format Markdown DAG representation
  const edgeRows = graph.edges.map((e) => {
    const c = graph.claims[e.claimId];
    const s = graph.sources[e.sourceId];
    return `| ${e.relation === "SUPPORTS" ? "✓" : e.relation === "CONTRADICTS" ? "!" : "?"} ${e.relation} | ${c?.claimText.slice(0, 40)}... | ${s?.title.slice(0, 40)}... | ${e.locator || "—"} |`;
  });

  const formattedGraphSummary = `### Claim-Evidence Graph
Total Nodes: ${Object.keys(graph.claims).length} claims, ${Object.keys(graph.sources).length} sources
Total Provenance Edges: ${graph.edges.length}

| Relation | Claim Excerpt | Evidence Source | Identifier / Locator |
|----------|---------------|-----------------|----------------------|
${edgeRows.length > 0 ? edgeRows.join("\n") : "| — | No active edges | — | — |"}

### Contradiction Map
${contradictions.length > 0 ? contradictions.map((c) => `- [!] ${c.observedText} <=> ${c.conflictingEvidence}`).join("\n") : "No fatal contradictions detected."}

### Evidence Gap Map
${gaps.length > 0 ? gaps.map((g) => `- [?] ${g.description}`).join("\n") : "Zero evidence gaps identified."}`;

  return {
    contradictions,
    gaps,
    formattedGraphSummary,
  };
}
