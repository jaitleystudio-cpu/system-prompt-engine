/**
 * Proposes automated, non-destructive scene optimizations and verifies safety.
 */

export interface OptimizationOperation {
  type: string;
  targetId?: string;
  parameters?: Record<string, unknown>;
}

export function validateOptimizationSafety(
  patch: { operations: Array<{ type: string; targetId?: string }> },
  essentialSectionIds: string[],
): void {
  for (const op of patch.operations) {
    if (op.type === "delete-section" || op.type === "remove-node") {
      if (op.targetId && essentialSectionIds.includes(op.targetId)) {
        throw new Error(
          `ESSENTIAL_CONTENT_DELETED: Optimization cannot delete essential content section "${op.targetId}" to improve framerate`,
        );
      }
    }
  }
}
