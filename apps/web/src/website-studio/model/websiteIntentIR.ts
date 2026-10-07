export interface WebsiteIntentIR {
  purpose: string;
  audience: string;
  primaryAction: string;
  siteType: "landing" | "portfolio" | "product" | "storytelling" | "business" | "editorial";
  sections: { id: string; intent: string }[];
  constraints: string[];
}
