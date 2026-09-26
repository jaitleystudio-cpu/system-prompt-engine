import { useState } from "react";
import type {
  LocalExecutionRecord,
  SpeArtifactV1,
} from "@spe/web-runtime";
import { getMirroredProviderProfile } from "@spe/web-runtime";
import type { ContextProtocolCompileOutput } from "../engine/types";

type Presentation = "simple" | "inspect";

type Props = {
  protocolOutput: ContextProtocolCompileOutput | null;
  artifact: SpeArtifactV1 | null;
  record: LocalExecutionRecord | null;
  busy?: boolean;
  onRunDry: () => void;
  /** Preferred presentation; panel still owns a user toggle over the same state. */
  initialPresentation?: Presentation;
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

function mark(ok: boolean | null): string {
  if (ok === null) return "·";
  return ok ? "✓" : "✗";
}

export function ExecutionContractPanel({
  protocolOutput,
  artifact,
  record,
  busy = false,
  onRunDry,
  initialPresentation = "simple",
}: Props) {
  const [presentation, setPresentation] =
    useState<Presentation>(initialPresentation);

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

  const goalText =
    artifact?.user_request?.trim() ||
    String(record?.contract.goal ?? "").trim() ||
    "—";
  const profileId =
    record?.contract.provider_profile_id ?? "— (run local dry-run to bind)";
  const constraintsOk = record
    ? record.checks.find((c) => c.id === "constraints-preserved")?.status ===
      "PASS"
    : hardConstraints.length > 0 || Boolean(desiredOutput);
  const goalOk = Boolean(goalText && goalText !== "—");
  const authorityNone =
    authority.status === "NONE" &&
    authority.level === 0 &&
    authority.grants.length + authority.execution_grants.length === 0;
  const sideEffectsNone =
    !record || record.side_effects === "NONE" || record.executed === false;
  const runState = record
    ? record.executed
      ? "EXECUTED"
      : record.outcome.replaceAll("_", " ")
    : "NOT EXECUTED";
  const conformance = record?.conformance.overall ?? "UNKNOWN";
  const conformanceTone = conformance.toLowerCase();

  return (
    <section
      className="spe-execution-contract"
      data-presentation={presentation}
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
        <div className="spe-contract-toolbar">
          <div
            className="spe-contract-presentation"
            role="group"
            aria-label="Contract presentation"
          >
            <button
              type="button"
              className="spe-contract-presentation-btn"
              aria-pressed={presentation === "simple"}
              onClick={() => setPresentation("simple")}
            >
              Simple
            </button>
            <button
              type="button"
              className="spe-contract-presentation-btn"
              aria-pressed={presentation === "inspect"}
              onClick={() => setPresentation("inspect")}
            >
              Inspect
            </button>
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
        </div>
      </header>

      {presentation === "simple" ? (
        <div
          className="spe-contract-simple"
          data-conformance={conformanceTone}
          aria-label="Simple contract summary"
        >
          <p className="spe-contract-simple-status">
            {protocolOutput || record ? "Prepared" : "Not prepared"}
          </p>
          <ul className="spe-contract-simple-list">
            <li data-ok={goalOk ? "true" : "false"}>
              <span aria-hidden="true">{mark(goalOk)}</span>
              <span>
                {goalOk ? "Goal preserved" : "Goal not yet bound"}
              </span>
            </li>
            <li data-ok={constraintsOk ? "true" : "false"}>
              <span aria-hidden="true">{mark(constraintsOk)}</span>
              <span>
                {constraintsOk
                  ? "Hard constraints preserved"
                  : "Hard constraints not verified"}
              </span>
            </li>
            <li data-ok={authorityNone ? "true" : "false"}>
              <span aria-hidden="true">{mark(authorityNone)}</span>
              <span>
                {authorityNone
                  ? "No authority granted"
                  : `Authority status: ${authority.status}`}
              </span>
            </li>
            <li data-ok={sideEffectsNone ? "true" : "false"}>
              <span aria-hidden="true">{mark(sideEffectsNone)}</span>
              <span>
                {sideEffectsNone
                  ? "No side effects authorized"
                  : "Side effects present"}
              </span>
            </li>
            <li data-kind="profile">
              <span aria-hidden="true">·</span>
              <span>
                Profile {profileId}
                {record?.contract.profile_version
                  ? ` · ${record.contract.profile_version}`
                  : ""}
              </span>
            </li>
            <li data-kind="run">
              <span aria-hidden="true">·</span>
              <span>Run {runState}</span>
            </li>
            <li
              data-kind="conformance"
              data-status={conformanceTone}
            >
              <span aria-hidden="true">·</span>
              <span>
                Conformance {conformance}
                {conformance === "UNKNOWN"
                  ? " — not a pass"
                  : conformance === "FAIL"
                    ? " — blocked"
                    : ""}
              </span>
            </li>
          </ul>
          <p className="spe-contract-simple-goal">
            <strong>Prepared goal</strong>
            <span>{goalText}</span>
          </p>
          <p className="spe-contract-simple-law">
            Same underlying contract as Inspect. UNKNOWN is never treated as
            PASS. Selection is not an authority grant.
          </p>
        </div>
      ) : (
        <>
          <div className="spe-contract-grid">
            <article className="spe-contract-card" data-section="contract">
              <span className="spe-contract-label">CONTRACT</span>
              <h3>What is prepared</h3>
              <dl>
                <div>
                  <dt>Goal</dt>
                  <dd>{goalText}</dd>
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
                  <dd>{profileId}</dd>
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
                  <dd>
                    {authority.grants.length + authority.execution_grants.length}
                  </dd>
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
                    <dd>
                      {shortDigest(record.contract.provider_profile_digest)}
                    </dd>
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
                    {record.conformance.pass} PASS · {record.conformance.fail}{" "}
                    FAIL · {record.conformance.unknown} UNKNOWN
                  </p>
                </header>
                <p className="spe-conformance-law">
                  PASS applies only to the listed local check. UNKNOWN is not
                  PASS.
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
        </>
      )}
    </section>
  );
}
