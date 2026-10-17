import { receiptWords } from "../engine/quality-request.mjs";

export function QualityReceiptPanel({
  receipt,
  fallback,
}: {
  receipt: {
    validation?: string | null;
    disposition?: string | null;
    proofClass?: string | null;
  } | null;
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
  const words = receiptWords(receipt);
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
