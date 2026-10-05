export type PrivacyBoundary = "LOCAL" | "PUBLIC_FETCH" | "EXTERNAL_PROVIDER";

export type DataSource =
  | { type: "LOCAL_CONSTANT"; value: unknown }
  | { type: "LOCAL_PROJECT_DATA"; key: string }
  | { type: "PUBLIC_FETCH"; url: string }
  | { type: "EXTERNAL_PROVIDER"; provider: string; resource: string };

export type SafeTransform =
  | { type: "number-scale"; factor: number }
  | { type: "map-enum"; entries: Record<string, string | number | boolean> }
  | { type: "boolean-invert" }
  | { type: "string-template"; template: string };

export interface DataBinding {
  id: string;
  source: DataSource;
  privacyBoundary: PrivacyBoundary;
  variable: string;
  transform?: SafeTransform;
  consumers: { targetId: string; property: string }[];
  refreshPolicy?: "once" | "manual" | "interval";
}

const SAFE_TRANSFORMS = new Set(["number-scale", "map-enum", "boolean-invert", "string-template"]);

export function validateDataBinding(binding: DataBinding): void {
  if (!binding?.id || !binding.variable) throw new Error("data binding id and variable required");
  if (!Array.isArray(binding.consumers)) throw new Error("data binding consumers must be an array");
  if (binding.transform && !SAFE_TRANSFORMS.has((binding.transform as { type?: string }).type || "")) {
    throw new Error("unsafe or unknown data transform refused");
  }
  if (binding.source.type === "LOCAL_CONSTANT" || binding.source.type === "LOCAL_PROJECT_DATA") {
    if (binding.privacyBoundary !== "LOCAL") throw new Error("local source must use LOCAL privacy boundary");
  }
}
