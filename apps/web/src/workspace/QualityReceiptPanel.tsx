/**
 * Displays kernel quality words. It does not calculate them.
 */
type QualityReceiptView = {
  validation?: string | null;
  disposition?: string | null;
  proofClass?: string | null;
};

export function QualityReceiptPanel({
  receipt,
  fallback,
}: {
  receipt: QualityReceiptView | null;
  fallback: boolean;
}) {
  if (fallback) {
    return (
      <aside className="spe-quality-receipt" aria-label="Safe fallback">
        <h2>Safe fallback</h2>
        <p>
          Safe fallback — SPE&apos;s full engine was unavailable. This prompt preserves your original
          request but has not received SPE&apos;s normal semantic verification.
        </p>
      </aside>
    );
  }
  if (!receipt) return null;
  const words = [receipt.disposition, receipt.validation, receipt.proofClass].filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
  return (
    <aside className="spe-quality-receipt" aria-label="Quality receipt">
      <h2>Quality receipt</h2>
      <ul>
        {words.map((word) => (
          <li key={word}>{word}</li>
        ))}
      </ul>
    </aside>
  );
}
