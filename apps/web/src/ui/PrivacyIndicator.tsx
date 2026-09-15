
type Props = {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
};

/** Truthful privacy indicator from envelope labels only — never inferred. */
export function PrivacyIndicator({ sensitivity, trust, authority }: Props) {
  const label = sensitivity
    ? `Privacy: ${sensitivity}${trust ? ` / ${trust}` : ""}${authority ? ` / ${authority}` : ""}`
    : "Privacy: (no envelope labels yet)";
  return (
    <span
      className="pill"
      role="status"
      aria-label={label}
      title="Labels copied from the current envelope only. Not inferred."
    >
      {label}
    </span>
  );
}
