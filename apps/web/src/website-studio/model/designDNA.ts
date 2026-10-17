export interface DesignDNA {
  colors: { background: string; text: string; accents: string[] };
  typography: { headingFamily: string; bodyFamily: string };
  spacingScale: number[];
  radiusScale: number[];
  provenanceState: "OBSERVED" | "INFERRED" | "UNKNOWN";
}

export function createDefaultDesignDNA(): DesignDNA {
  return {
    colors: { background: "#0b0d12", text: "#f7f8fb", accents: ["#7c8cff"] },
    typography: { headingFamily: "system-ui", bodyFamily: "system-ui" },
    spacingScale: [4, 8, 12, 16, 24, 32, 48, 64],
    radiusScale: [0, 6, 12, 24],
    provenanceState: "UNKNOWN",
  };
}
