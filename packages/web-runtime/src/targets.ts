/** Target AI selector — changes rendering only, not protected intent. */

export const TARGETS = [
  { id: "any", label: "Any AI" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "copilot", label: "Copilot" },
  { id: "local", label: "Local Model" },
  { id: "custom", label: "Custom" },
] as const;

export type TargetId = (typeof TARGETS)[number]["id"];

export const CATEGORIES = [
  "AI Assistant",
  "Writing",
  "Coding",
  "Research",
  "Business",
  "Education",
  "Analysis",
  "Structured Data",
  "Creative",
  "Multilingual",
  "Website / 3D",
  "Image",
  "Video",
] as const;

export type CategoryId = (typeof CATEGORIES)[number];
