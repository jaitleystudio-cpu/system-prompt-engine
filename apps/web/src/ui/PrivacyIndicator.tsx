type Props = {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
  online: boolean;
};

/** PrivacyIndicator — labels from envelope privacy only; never inferred. */
export function PrivacyIndicator({ sensitivity, trust, authority, online }: Props) {
  return (
    <div className="header-meta" aria-label="Privacy status">
      <span className={`pill ${online ? "ok" : "warn"}`}>
        {online ? "online shell" : "offline shell"}
      </span>
      <span className="pill">sensitivity: {sensitivity ?? "—"}</span>
      <span className="pill">trust: {trust ?? "—"}</span>
      <span className="pill">authority: {authority ?? "—"}</span>
      <span className="pill">compile: local · no cloud</span>
    </div>
  );
}
