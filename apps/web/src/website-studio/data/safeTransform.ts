/**
 * Safe, sandboxed transformations for data binding values.
 * Strictly no eval or dynamic JavaScript execution.
 */
import type { SafeTransform } from "../model/dataBinding.ts";

export function applySafeTransform(
  value: unknown,
  transform?: SafeTransform | { type: string; [key: string]: unknown },
): unknown {
  if (!transform) return value;

  switch (transform.type) {
    case "number-scale": {
      const num = Number(value);
      if (Number.isNaN(num)) return value;
      const factor = typeof transform.factor === "number" ? transform.factor : 1;
      return num * factor;
    }

    case "boolean-invert": {
      return !Boolean(value);
    }

    case "map-enum": {
      const entries = (transform as any).entries || (transform as any).mapping || {};
      const key = String(value);
      return key in entries ? entries[key] : value;
    }

    case "string-template": {
      const template = String(transform.template || "{value}");
      return template.replaceAll("{value}", String(value ?? "")).replaceAll("{{value}}", String(value ?? ""));
    }

    default:
      throw new Error(`UNSAFE_TRANSFORM: Transform type "${transform.type}" is not an approved safe transformation`);
  }
}
