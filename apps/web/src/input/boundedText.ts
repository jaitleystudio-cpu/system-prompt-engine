/** Bounded quick-start / field limits — no silent truncation. */

export const HOME_QUICK_START_MAX_CHARS = 20_000;
export const DESIRED_OUTPUT_MAX_CHARS = 12_000;
export const EXAMPLE_MAX_CHARS = 12_000;

export type BoundResult = {
  attempted: number;
  accepted: number;
  value: string;
  overflow: boolean;
  /** Always false when callers use this helper instead of HTML maxLength. */
  silentLoss: false;
  notice: string | null;
};

export function formatCharCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function applyTextBound(
  raw: string,
  max: number,
  opts: { createHint?: boolean; fieldLabel?: string } = {},
): BoundResult {
  const attempted = raw.length;
  if (attempted <= max) {
    return {
      attempted,
      accepted: attempted,
      value: raw,
      overflow: false,
      silentLoss: false,
      notice: null,
    };
  }
  const label = opts.fieldLabel ?? "This field";
  const createHint = opts.createHint
    ? " For longer material, open Create and paste there — overflow is not kept in this quick-start field."
    : "";
  return {
    attempted,
    accepted: max,
    value: raw.slice(0, max),
    overflow: true,
    silentLoss: false,
    notice: `${label} accepts up to ${formatCharCount(max)} characters. ${formatCharCount(attempted)} were offered; only the first ${formatCharCount(max)} were kept.${createHint}`,
  };
}

export function nearLimit(length: number, max: number, warnAt = 0.9): boolean {
  return length >= Math.floor(max * warnAt);
}
