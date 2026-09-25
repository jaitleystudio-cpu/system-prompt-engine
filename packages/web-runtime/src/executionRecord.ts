import {
  sha256Hex,
  type SpeArtifactV1,
} from "./speArtifact";

export type ConformanceStatus = "PASS" | "FAIL" | "UNKNOWN";

export type ConformanceCheck = {
  id: string;
  label: string;
  status: ConformanceStatus;
  detail: string;
};

export type BoundExecutionContract = {
  protocol_id: string;
  depth: string;
  wasm_contract: unknown;
  goal: string;
  hard_constraints: {
    id: string;
    statement: string;
    strength: string;
  }[];
  acceptance_criteria: string[];
  authority: {
    status: string;
    level: number;
    grants: string[];
    execution_grants: string[];
  };
  example: {
    present: boolean;
    classification: "EXAMPLE / USER_SUPPLIED";
    non_authoritative: true;
  };
};

export type LocalExecutionRecord = {
  record_format: "spe.local-execution-record.v1";
  recorded_at_utc: string;
  build_sha: string;
  mode: "LOCAL_DRY_RUN";
  side_effects: "NONE";
  executed: false;
  outcome: "NOT_EXECUTED" | "BLOCKED";
  contract: BoundExecutionContract;
  quality_record: unknown;
  checks: ConformanceCheck[];
  conformance: {
    overall: ConformanceStatus;
    pass: number;
    fail: number;
    unknown: number;
  };
  digests: {
    input_artifact_sha256: string;
    goal_sha256: string;
    hard_constraints_sha256: string;
    contract_sha256: string;
    quality_record_sha256: string;
    prompt_sha256: string;
    record_sha256: string;
  };
};

type ProtocolOutputLike = {
  execution_contract: unknown;
  quality_record: unknown;
  rendered?: string;
};

type BuildLocalExecutionRecordInput = {
  artifact: SpeArtifactV1;
  protocolOutput: ProtocolOutputLike;
  buildSha: string;
  recordedAtUtc?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = asRecord(item);
        return parsed ? [parsed] : [];
      })
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  const object = asRecord(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, canonicalize(object[key])]),
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function summarizeConformance(
  statuses: ConformanceStatus[],
): ConformanceStatus {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("UNKNOWN")) return "UNKNOWN";
  return "PASS";
}

export async function buildLocalExecutionRecord({
  artifact,
  protocolOutput,
  buildSha,
  recordedAtUtc = new Date().toISOString(),
}: BuildLocalExecutionRecordInput): Promise<LocalExecutionRecord> {
  const envelope = asRecord(artifact.envelope);
  const payload = asRecord(envelope?.payload);
  const hardConstraints = asRecords(payload?.hard_constraints).map(
    (constraint) => ({
      id: String(constraint.constraint_id ?? ""),
      statement: String(constraint.statement ?? ""),
      strength: String(constraint.strength ?? ""),
    }),
  );
  const preferences = asRecords(payload?.user_preferences);
  const authorityState = asRecord(payload?.authority_state);
  const executionGrants = strings(payload?.execution_grants);
  const authority = {
    status: String(authorityState?.status ?? "NONE"),
    level:
      typeof authorityState?.level === "number" ? authorityState.level : 0,
    grants: strings(authorityState?.grants),
    execution_grants: executionGrants,
  };
  const protectedConstraints = artifact.intent.confirmed.filter((atom) =>
    atom.text.trim(),
  );
  const constraintsPreserved = protectedConstraints.every((atom) =>
    hardConstraints.some(
      (constraint) =>
        constraint.id === atom.id &&
        constraint.statement === atom.text &&
        constraint.strength === "HARD",
    ),
  );
  const desiredOutput = artifact.intent.confirmed.find(
    (atom) => atom.id === "desired-output" && atom.text.trim(),
  );
  const desiredOutputHard =
    !desiredOutput ||
    hardConstraints.some(
      (constraint) =>
        constraint.id === "desired-output" &&
        constraint.statement === desiredOutput.text &&
        constraint.strength === "HARD",
    );
  const example = artifact.intent.assumed.find(
    (atom) => atom.id === "desired-example" && atom.text.trim(),
  );
  const exampleInHard = hardConstraints.some(
    (constraint) => constraint.id === "desired-example",
  );
  const examplePreference = preferences.find(
    (preference) => preference.preference_id === "desired-example",
  );
  const exampleClassified =
    !example ||
    (!exampleInHard &&
      typeof examplePreference?.statement === "string" &&
      examplePreference.statement.includes("NON-AUTHORITATIVE") &&
      examplePreference.statement.includes("USER_SUPPLIED"));
  const authoritySafe =
    authority.status === "NONE" &&
    authority.level === 0 &&
    authority.grants.length === 0 &&
    authority.execution_grants.length === 0;
  const contract = asRecord(protocolOutput.execution_contract);
  const graph = asRecord(contract?.graph);
  const protocolId = String(
    contract?.protocol_id ?? graph?.protocol_id ?? "",
  );
  const depth = String(contract?.depth ?? graph?.depth ?? "");
  const contractPresent = Boolean(protocolId && depth && graph);
  const quality = asRecord(protocolOutput.quality_record);
  const failedNodes = strings(quality?.failed_nodes);
  const unknownNodes = strings(quality?.unknown_nodes);
  const evaluatorStatuses = asRecords(quality?.evaluator_results).map(
    (result) => String(result.status),
  );
  const protocolStatus: ConformanceStatus =
    failedNodes.length > 0 || evaluatorStatuses.includes("FAIL")
      ? "FAIL"
      : unknownNodes.length > 0 || evaluatorStatuses.includes("UNKNOWN")
        ? "UNKNOWN"
        : "PASS";
  const checks: ConformanceCheck[] = [
    {
      id: "wasm-contract-present",
      label: "WASM contract present",
      status: contractPresent ? "PASS" : "FAIL",
      detail: contractPresent
        ? `${protocolId} · ${depth}`
        : "No execution contract was returned by the local WASM path.",
    },
    {
      id: "constraints-preserved",
      label: "Hard constraints preserved",
      status: constraintsPreserved ? "PASS" : "FAIL",
      detail: constraintsPreserved
        ? `${protectedConstraints.length} protected constraints retained without weakening.`
        : "A protected constraint is missing, changed, or no longer HARD.",
    },
    {
      id: "desired-output-hard",
      label: "Desired Output remains HARD",
      status: desiredOutputHard ? "PASS" : "FAIL",
      detail: desiredOutput
        ? "The supplied outcome remains a HARD constraint."
        : "No Desired Output was supplied.",
    },
    {
      id: "authority-not-escalated",
      label: "Authority not escalated",
      status: authoritySafe ? "PASS" : "FAIL",
      detail: authoritySafe
        ? "Authority is NONE; no grants or side-effect permission were created."
        : "Unexpected authority or execution grants are present.",
    },
    {
      id: "example-non-authoritative",
      label: "Example remains non-authoritative",
      status: exampleClassified ? "PASS" : "FAIL",
      detail: example
        ? "Example remains USER_SUPPLIED / NON-AUTHORITATIVE and is not HARD."
        : "No user example was supplied.",
    },
    {
      id: "protocol-outcome",
      label: "Protocol execution outcome",
      status: protocolStatus,
      detail:
        protocolStatus === "PASS"
          ? "All required protocol nodes have recorded completion."
          : protocolStatus === "FAIL"
            ? "At least one protocol node or evaluator failed."
            : "Required protocol nodes remain open; no target execution was claimed.",
    },
  ];
  const statuses = checks.map((check) => check.status);
  const overall = summarizeConformance(statuses);
  const hardConstraintsDigest = await sha256Hex(
    canonicalJson(hardConstraints),
  );
  const contractDigest = await sha256Hex(
    canonicalJson(protocolOutput.execution_contract),
  );
  const qualityDigest = await sha256Hex(
    canonicalJson(protocolOutput.quality_record),
  );
  const goalDigest = await sha256Hex(artifact.user_request);
  const promptDigest =
    typeof quality?.prompt_digest === "string" && quality.prompt_digest
      ? quality.prompt_digest
      : await sha256Hex(artifact.rendered_prompt);
  const base = {
    record_format: "spe.local-execution-record.v1" as const,
    recorded_at_utc: recordedAtUtc,
    build_sha: buildSha,
    mode: "LOCAL_DRY_RUN" as const,
    side_effects: "NONE" as const,
    executed: false as const,
    outcome: (overall === "FAIL"
      ? "BLOCKED"
      : "NOT_EXECUTED") as LocalExecutionRecord["outcome"],
    contract: {
      protocol_id: protocolId,
      depth,
      wasm_contract: protocolOutput.execution_contract,
      goal: artifact.user_request,
      hard_constraints: hardConstraints,
      acceptance_criteria: desiredOutput ? [desiredOutput.text] : [],
      authority,
      example: {
        present: Boolean(example),
        classification: "EXAMPLE / USER_SUPPLIED" as const,
        non_authoritative: true as const,
      },
    },
    quality_record: protocolOutput.quality_record,
    checks,
    conformance: {
      overall,
      pass: statuses.filter((status) => status === "PASS").length,
      fail: statuses.filter((status) => status === "FAIL").length,
      unknown: statuses.filter((status) => status === "UNKNOWN").length,
    },
    digests: {
      input_artifact_sha256: artifact.integrity.content_sha256,
      goal_sha256: goalDigest,
      hard_constraints_sha256: hardConstraintsDigest,
      contract_sha256: contractDigest,
      quality_record_sha256: qualityDigest,
      prompt_sha256: promptDigest,
      record_sha256: "",
    },
  };
  const recordDigest = await sha256Hex(canonicalJson(base));
  return {
    ...base,
    digests: {
      ...base.digests,
      record_sha256: recordDigest,
    },
  };
}
