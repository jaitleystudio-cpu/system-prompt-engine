export interface ProvenanceEntry {
  id: string;
  source: "USER" | "REFERENCE" | "SYSTEM" | "AGENT";
  state: "OBSERVED" | "INFERRED" | "UNKNOWN";
  detail?: string;
}

export interface ProvenanceGraph {
  entries: ProvenanceEntry[];
}
