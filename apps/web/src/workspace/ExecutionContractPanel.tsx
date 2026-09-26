import type {
  LocalExecutionRecord,
  SpeArtifactV1,
} from "@spe/web-runtime";
import { getMirroredProviderProfile } from "@spe/web-runtime";
import type { ContextProtocolCompileOutput } from "../engine/types";

type Props = {
  protocolOutput: ContextProtocolCompileOutput | null;
  artifact: SpeArtifactV1 | null;
  record: LocalExecutionRecord | null;
  busy?: boolean;
  onRunDry: () => void;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const parsed = asRecord(item);
        return parsed ? [parsed] : [];
      })
    : [];
}

function shortDigest(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 20
    ? `${value.slice(0, 10)}…${value.slice(-8)}`
    : value;
}

function plannedStageLabel(stage: unknown): string {
  const value = String(stage ?? "STAGE");
  if (value === "EXECUTE") return "EXECUTE · PLANNED";
  if (value === "VERIFY") return "VERIFY · PLANNED";
  if (value === "DELIVER") return "DELIVER · PLANNED";
  return value;
}

export function ExecutionContractPanel({
  protocolOutput,
  artifact,
  record,
  busy = false,
  onRunDry,
}: Props) {
  if (!protocolOutput && !record) return null;

  const contract =
    asRecord(protocolOutput?.execution_contract) ??
    asRecord(record?.contract.wasm_contract);
  const graph = asRecord(contract?.graph);
  const stages = records(graph?.nodes).slice(0, 8);
  const hardConstraints =
    record?.contract.hard_constraints ??
    artifact?.intent.confirmed
      .filter((atom) => atom.text.trim())
      .map((atom) => ({
        id: atom.id,
        statement: atom.text,
        strength: "HARD",
      })) ??
    [];
  const desiredOutput = artifact?.intent.confirmed.find(
    (atom) => atom.id === "desired-output" && atom.text.trim(),
  )?.text;
  const example = artifact?.intent.assumed.find(
    (atom) => atom.id === "desired-example" && atom.text.trim(),
  )?.text;
  const authority = record?.contract.authority ?? {
    status: "NONE",
    level: 0,
    grants: [],
    execution_grants: [],
  };

  return (
    <section
      className="spe-execution-contract"
      aria-labelledby="execution-contract-title"
    >
      <header>
        <div>
          <p className="spe-kicker">Local preparation</p>
          <h2 id="execution-contract-title">Execution Contract</h2>
          <p>
            Bound to your protected brief. This prepares and checks a local run;
            it does not run a target AI or side-effect tool.
          </p>
        </div>
        <button
          type="button"
          className="spe-build"
          disabled={!artifact || !protocolOutput || busy}
          aria-busy={busy}
          onClick={onRunDry}
        >
          {busy
            ? "Checking locally…"
            : record
              ? "Run local dry-run again"
              : "Run local dry-run"}
        </button>
      </header>

      <div className="spe-contract-grid">
        <article className="spe-contract-card" data-section="contract">
          <span className="spe-contract-label">CONTRACT</span>
          <h3>What is prepared</h3>
          <dl>
            <div>
              <dt>Goal</dt>
              <dd>{artifact?.user_request ?? record?.contract.goal ?? "—"}</dd>
            </div>
            <div>
              <dt>Protocol</dt>
              <dd>
                {String(
                  contract?.protocol_id ??
                    graph?.protocol_id ??
                    record?.contract.protocol_id ??
                    "—",
                )}
              </dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd>
                {String(
                  contract?.depth ??
                    graph?.depth ??
                    record?.contract.depth ??
                    "—",
                )}
              </dd>
            </div>
          </dl>
          <h4>Hard constraints</h4>
          {hardConstraints.length ? (
            <ul>
              {hardConstraints.map((constraint) => (
                <li key={constraint.id}>
                  <strong>{constraint.strength}</strong>
                  <span>{constraint.statement}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No additional hard constraints were supplied.</p>
          )}
          {desiredOutput ? (
            <>
              <h4>Acceptance criteria</h4>
              <p>{desiredOutput}</p>
            </>
          ) : null}
        </article>

        <article className="spe-contract-card" data-section="active-profile">
          <span className="spe-contract-label">ACTIVE PROFILE</span>
          <h3>What is selected</h3>
          <dl>
            <div>
              <dt>Profile</dt>
              <dd>
                {record?.contract.provider_profile_id ??
                  "— (run local dry-run to bind)"}
              </dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{record?.contract.profile_version ?? "—"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {record?.contract.profile_selection_status ?? "UNBOUND"}
              </dd>
            </div>
            <div>
              <dt>Digest</dt>
              <dd>
                {shortDigest(record?.contract.provider_profile_digest)}
              </dd>
            </div>
            <div>
              <dt>Capabilities</dt>
              <dd>
                {(() => {
                  const pid = record?.contract.provider_profile_id;
                  const mirrored = pid
                    ? getMirroredProviderProfile(pid)
                    : null;
                  if (!mirrored?.capabilities?.length) {
                    return "— (run local dry-run to bind)";
                  }
                  return mirrored.capabilities.join(", ");
                })()}
              </dd>
            </div>
          </dl>
          <p className="spe-profile-law">
            selection ≠ authority grant · env tags are declarations only · display:{" "}
            {record?.contract.profile_display_source ?? "ts_mirror"}
          </p>
          <h4>Selection reason</h4>
          <p>
            {record?.contract.profile_selection_reason ??
              "No provider profile bound yet. Local dry-run binds a local-first profile into the run record without minting authority."}
          </p>
          <p className="spe-profile-owner">
            Semantic owner:{" "}
            {record?.contract.profile_semantic_owner ??
              "spe_runtime.providers.profiles+adapter"}
          </p>
        </article>

        <article className="spe-contract-card" data-section="authority">
          <span className="spe-contract-label">AUTHORITY</span>
          <h3>What is authorized</h3>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{authority.status}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{authority.level}</dd>
            </div>
            <div>
              <dt>Grants</dt>
              <dd>{authority.grants.length + authority.execution_grants.length}</dd>
            </div>
            <div>
              <dt>Side effects</dt>
              <dd>NONE</dd>
            </div>
          </dl>
          <p className="spe-authority-law">
            recommend ≠ authorize ≠ execute
          </p>
          <h4>Example handling</h4>
          <p>
            {example
              ? "EXAMPLE / USER_SUPPLIED · NON-AUTHORITATIVE"
              : "No user example supplied."}
          </p>
        </article>
      </div>

      {stages.length ? (
        <div>
          <p className="spe-contract-stage-note">
            Planned contract stages only. None are executed by this local
            dry-run.
          </p>
          <ol className="spe-contract-stages" aria-label="Contract stages">
            {stages.map((stage, index) => (
              <li key={String(stage.node_id ?? index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{plannedStageLabel(stage.stage)}</strong>
                <small>
                  Contract instruction · {String(stage.title ?? "")}
                </small>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {record ? (
        <>
          <div className="spe-run-record">
            <div>
              <span className="spe-contract-label">LOCAL RUN RECORD</span>
              <h3>{record.outcome.replaceAll("_", " ")}</h3>
              <p>
                Prepared locally with no side effects. This records contract
                checks, not target execution or verified success.
              </p>
            </div>
            <dl>
              <div>
                <dt>Recorded</dt>
                <dd>{record.recorded_at_utc}</dd>
              </div>
              <div>
                <dt>Build tip</dt>
                <dd>{shortDigest(record.build_sha)}</dd>
              </div>
              <div>
                <dt>Input artifact</dt>
                <dd>{shortDigest(record.digests.input_artifact_sha256)}</dd>
              </div>
              <div>
                <dt>Record digest</dt>
                <dd>{shortDigest(record.digests.record_sha256)}</dd>
              </div>
              <div>
                <dt>Executed</dt>
                <dd>NO</dd>
              </div>
              <div>
                <dt>Side effects</dt>
                <dd>{record.side_effects}</dd>
              </div>
              <div>
                <dt>Provider profile</dt>
                <dd>
                  {record.contract.provider_profile_id ?? "—"} ·{" "}
                  {record.contract.profile_version ?? "—"}
                </dd>
              </div>
              <div>
                <dt>Profile digest</dt>
                <dd>{shortDigest(record.contract.provider_profile_digest)}</dd>
              </div>
            </dl>
          </div>

          <section
            className="spe-conformance"
            data-overall={record.conformance.overall.toLowerCase()}
            aria-labelledby="conformance-title"
          >
            <header>
              <div>
                <span className="spe-contract-label">CONFORMANCE</span>
                <h3 id="conformance-title">
                  Overall: {record.conformance.overall}
                </h3>
              </div>
              <p>
                {record.conformance.pass} PASS · {record.conformance.fail} FAIL ·{" "}
                {record.conformance.unknown} UNKNOWN
              </p>
            </header>
            <p className="spe-conformance-law">
              PASS applies only to the listed local check. UNKNOWN is not PASS.
            </p>
            <ul>
              {record.checks.map((check) => (
                <li key={check.id} data-status={check.status.toLowerCase()}>
                  <span>{check.status}</span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="spe-contract-before-run">
          No local run record yet. Running the dry-run checks the prepared
          contract only; it will not execute the task.
        </p>
      )}
    </section>
  );
}
