import { validateDataBinding, type DataBinding } from "../model/dataBinding.ts";

export function compileDataIntent(raw: string): DataBinding[] {
  const lower = raw.trim().toLowerCase();
  if (!lower) return [];

  const bindings: DataBinding[] = [];
  if (/stock|inventory/.test(lower)) {
    const binding: DataBinding = {
      id: "product-stock",
      source: { type: "LOCAL_PROJECT_DATA", key: "product.stock" },
      privacyBoundary: "LOCAL",
      variable: "product.stock",
      consumers: [
        { targetId: "sold-out", property: "visibility" },
        { targetId: "product", property: "rotation-enabled" },
      ],
      refreshPolicy: "manual",
    };
    validateDataBinding(binding);
    bindings.push(binding);
  }
  return bindings;
}
