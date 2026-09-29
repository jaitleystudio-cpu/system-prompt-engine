export type DeliveryDecision = {
  terminal: string;
  fallback: boolean;
  validation: string | null;
  repairedPrompt?: string | null;
};

export function decideDelivery(event: {
  kind: string;
  hasCanonical?: boolean;
  receipt?: {
    reconstruction?: {
      kept?: string;
      plan?: { disposition?: string };
      kept_subject?: { compiled_prompt?: string };
    };
    receipt?: { verdict?: string };
  };
}): DeliveryDecision;
