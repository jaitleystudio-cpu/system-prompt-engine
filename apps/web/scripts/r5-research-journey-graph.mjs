/**
 * Binds an already-acquired research journey to the existing claim graph
 * and continuation compiler. Does not fetch, does not mount a shell, and
 * does not decide LIVE_INDEX or LIVE_RETRACTION.
 */
import fs from "node:fs";

import { compileContinuationContract } from "../src/engine/continuation/continuationCompiler.ts";
import {
  buildClaimEvidenceGraph,
  mapContradictionsAndGaps,
} from "../src/engine/continuation/evidenceGraph.ts";

function fail(error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error) }));
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch (error) {
  fail(`GRAPH_INPUT_INVALID:${error}`);
}

const forbidden = Array.isArray(payload.forbidden_substrings)
  ? payload.forbidden_substrings.filter((item) => typeof item === "string" && item.length > 0)
  : [];

try {
  const claims = payload.claims || [];
  const sources = payload.sources || [];
  const graph = buildClaimEvidenceGraph(claims, sources);
  const mapped = mapContradictionsAndGaps(graph);
  const review = {
    verdict: "HOLD",
    claims,
    contradictions: mapped.contradictions,
    gaps: mapped.gaps,
    unknowns: payload.unknowns || [],
  };
  const submission = {
    taskId: payload.taskId || "r5-research-journey",
    originalTask: payload.publicQuery || "",
    targetAgent: "generic",
    candidateSha: payload.candidateSha || "r5-journey-not-a-release",
    authority: "REVIEW_ONLY",
    researchConsent: true,
  };
  const contract = compileContinuationContract(submission, review, graph);
  const prompt = String(contract.nextTaskPrompt || "");
  for (const secret of forbidden) {
    if (prompt.includes(secret) || String(submission.originalTask).includes(secret)) {
      fail("REJECTED_PRIVACY_PROMPT");
    }
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      prompt,
      contradictions: mapped.contradictions,
      gaps: mapped.gaps,
      edgeRelations: graph.edges.map((edge) => edge.relation),
      authority: contract.authority,
      verdict: review.verdict,
    }),
  );
} catch (error) {
  fail(error && error.stack ? error.stack : error);
}
