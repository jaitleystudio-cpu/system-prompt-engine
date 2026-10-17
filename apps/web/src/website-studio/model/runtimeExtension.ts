export interface RuntimeExtension {
  id: string;
  source: string;
  sandboxed: true;
  mayMutateCanonicalState: false;
}

export function validateRuntimeExtension(extension: RuntimeExtension): void {
  if (!extension?.id || extension.sandboxed !== true || extension.mayMutateCanonicalState !== false) {
    throw new Error("runtime extensions must be sandboxed and non-authoritative");
  }
}
