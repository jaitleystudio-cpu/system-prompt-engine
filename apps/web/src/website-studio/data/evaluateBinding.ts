import {
  validateDataBinding,
  type DataBinding,
  type SafeTransform,
} from "../model/dataBinding.ts";

function transform(value: unknown, rule: SafeTransform | undefined): unknown {
  if (!rule) return value;
  if (rule.type === "number-scale") {
    if (typeof value !== "number") throw new Error("DATA_BINDING_TYPE_MISMATCH");
    return value * rule.factor;
  }
  if (rule.type === "boolean-invert") {
    if (typeof value !== "boolean") throw new Error("DATA_BINDING_TYPE_MISMATCH");
    return !value;
  }
  if (rule.type === "map-enum") {
    const mapped = rule.entries[String(value)];
    if (mapped === undefined) throw new Error("DATA_BINDING_ENUM_MISSING");
    return mapped;
  }
  if (rule.type === "string-template") {
    return rule.template.replaceAll("{value}", String(value ?? ""));
  }
  throw new Error("DATA_BINDING_TRANSFORM_REFUSED");
}

export function evaluateBinding(
  binding: DataBinding,
  projectData: Record<string, unknown>,
): unknown {
  validateDataBinding(binding);
  let value: unknown;
  if (binding.source.type === "LOCAL_CONSTANT") {
    value = binding.source.value;
  } else if (binding.source.type === "LOCAL_PROJECT_DATA") {
    value = projectData[binding.source.key];
  } else {
    throw new Error("DATA_BINDING_NETWORK_EXECUTION_REQUIRES_DISCLOSED_ADAPTER");
  }
  return transform(value, binding.transform);
}

export function bindingBoundaryDisclosure(binding: DataBinding): {
  boundary: DataBinding["privacyBoundary"];
  leavesDevice: boolean;
} {
  return {
    boundary: binding.privacyBoundary,
    leavesDevice: binding.privacyBoundary !== "LOCAL",
  };
}
