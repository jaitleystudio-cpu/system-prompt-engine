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

export function deliveryForBrief(): DeliveryDecision;
export function deliveryForEngineDown(): DeliveryDecision;
export function deliveryForK3Down(): DeliveryDecision;
export function deliveryForQualityMiss(): DeliveryDecision;
export function deliveryForReceipt(receipt: unknown): DeliveryDecision;
export function usesRepairedPrompt(decision: DeliveryDecision): boolean;
