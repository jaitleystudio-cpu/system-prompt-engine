import {
  assertSafeStudioFetchUrl,
  assertStudioStringTemplateBounds,
} from "../security/studioSecurity.ts";

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
  if (binding.transform?.type === "string-template") {
    assertStudioStringTemplateBounds(binding.transform.template);
  }
  if (binding.source.type === "LOCAL_CONSTANT" || binding.source.type === "LOCAL_PROJECT_DATA") {
    if (binding.privacyBoundary !== "LOCAL") throw new Error("local source must use LOCAL privacy boundary");
  }
  if (binding.source.type === "PUBLIC_FETCH") {
    if (binding.privacyBoundary !== "PUBLIC_FETCH") {
      throw new Error("PUBLIC_FETCH_BOUNDARY_REQUIRED: public fetch source must disclose PUBLIC_FETCH privacy boundary");
    }
    if (!binding.source.url || typeof binding.source.url !== "string") {
      throw new Error("PUBLIC_FETCH_URL_REQUIRED: public fetch requires explicit URL");
    }
    assertSafeStudioFetchUrl(binding.source.url);
  }
  if (binding.source.type === "EXTERNAL_PROVIDER") {
    if (binding.privacyBoundary !== "EXTERNAL_PROVIDER") {
      throw new Error("EXTERNAL_PROVIDER_BOUNDARY_REQUIRED: external provider source must disclose EXTERNAL_PROVIDER privacy boundary");
    }
    if (!binding.source.provider || typeof binding.source.provider !== "string") {
      throw new Error("EXTERNAL_PROVIDER_REQUIRED: external provider requires provider identification");
    }
  }
}
