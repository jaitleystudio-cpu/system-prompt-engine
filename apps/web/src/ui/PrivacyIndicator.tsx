type Props = {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
  online: boolean;
};

/** PrivacyIndicator — labels from envelope privacy only; never inferred. */
export function PrivacyIndicator({ sensitivity, trust, authority, online }: Props) {
  return (
    <dl className="forge-privacy-indicator" aria-label="Privacy status">
      <div><dt>shell</dt><dd data-state={online ? "ok" : "warn"}>{online ? "online" : "offline"}</dd></div>
      <div><dt>sensitivity</dt><dd>{sensitivity ?? "—"}</dd></div>
      <div><dt>trust</dt><dd>{trust ?? "—"}</dd></div>
      <div><dt>authority</dt><dd>{authority ?? "—"}</dd></div>
      <div><dt>compile</dt><dd>local · no cloud</dd></div>
    </dl>
  );
}
