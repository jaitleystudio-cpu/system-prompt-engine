/** Prompt Gallery — ordinary prompt cards (moved out of Daily 3D Lab). */

export type GalleryCard = {
  id: string;
  title: string;
  blurb: string;
  seedIdea: string;
  category: string;
  accent: string;
};

export const PROMPT_GALLERY: GalleryCard[] = [
  { id: "gal-01", title: "Leave note", blurb: "A short, clear leave email.", seedIdea: "Write a polite leave-of-absence email for two days next week. Keep it under 120 words. No medical details.", category: "Writing", accent: "#7dd3fc" },
  { id: "gal-02", title: "Bug report", blurb: "Turn a vague bug into a crisp report.", seedIdea: "Turn this into a bug report with steps, expected vs actual, and severity: sign-in button sometimes does nothing on mobile Safari.", category: "Coding", accent: "#a7f3d0" },
  { id: "gal-03", title: "Study plan", blurb: "A week of focused study.", seedIdea: "Create a 7-day study plan for introductory statistics. 45 minutes a day. Include one practice problem each day.", category: "Education", accent: "#fde68a" },
  { id: "gal-04", title: "Product FAQ", blurb: "Answer shopper questions honestly.", seedIdea: "Draft FAQ answers for an offline writing app: pricing, offline mode, export formats, and privacy. No marketing fluff.", category: "Business", accent: "#fbcfe8" },
  { id: "gal-05", title: "Code review", blurb: "Review for safety and clarity.", seedIdea: "Review the TypeScript I paste for correctness, security, and maintainability. Rank findings by severity with concrete fixes. Do not invent files.", category: "Coding", accent: "#c4b5fd" },
  { id: "gal-06", title: "Meeting agenda", blurb: "A 30-minute agenda that respects time.", seedIdea: "Build a 30-minute product sync agenda with outcomes, timeboxes, and one decision to make. Avoid status theater.", category: "Business", accent: "#99f6e4" },
  { id: "gal-07", title: "Explain simply", blurb: "A concept for a curious teen.", seedIdea: "Explain how HTTPS keeps a connection private to a curious 14-year-old. One analogy, one worked example, three check questions.", category: "Education", accent: "#fdba74" },
  { id: "gal-08", title: "UI critique", blurb: "Honest notes on a screenshot.", seedIdea: "Critique this mobile UI for clarity, hierarchy, and accessibility. List five concrete improvements. Mark uncertainty.", category: "Website / 3D", accent: "#bef264" },
  { id: "gal-09", title: "Story spark", blurb: "A scene start, not a novel.", seedIdea: "Open a short story in a coastal town at dawn. Two characters, one secret. 200 words. No twist ending yet.", category: "Creative", accent: "#fda4af" },
  { id: "gal-10", title: "Research brief", blurb: "Scope a careful literature look.", seedIdea: "Outline a research brief on urban heat islands and tree canopy. List questions, evidence needs, and what would falsify the claim.", category: "Research", accent: "#93c5fd" },
  { id: "gal-11", title: "SQL helper", blurb: "Ask for a safe query.", seedIdea: "Help me write a PostgreSQL query for monthly active users with clear assumptions and indexes to consider. No destructive statements.", category: "Coding", accent: "#6ee7b7" },
  { id: "gal-12", title: "Support reply", blurb: "Warm, bounded customer care.", seedIdea: "Draft a support reply for a late shipment. Empathize, give two options, never invent tracking numbers.", category: "Business", accent: "#f9a8d4" },
  { id: "gal-13", title: "Interview prep", blurb: "Practice answers with structure.", seedIdea: "Help me prepare STAR answers for a product designer interview about conflict with engineering. Keep answers under 90 seconds spoken.", category: "Education", accent: "#fcd34d" },
  { id: "gal-14", title: "Accessibility pass", blurb: "Find a11y gaps in a flow.", seedIdea: "Review this checkout flow description for WCAG-minded gaps: focus order, labels, errors, and color-only cues. Prioritize fixes.", category: "Website / 3D", accent: "#a5b4fc" },
  { id: "gal-15", title: "Data caveats", blurb: "Chart claims with humility.", seedIdea: "Rewrite this chart caption so it states the sample, the window, and what it does not prove. Avoid causal language.", category: "Analysis", accent: "#5eead4" },
  { id: "gal-16", title: "Travel day", blurb: "A realistic one-day plan.", seedIdea: "Plan a one-day walking itinerary in Lisbon for two people who dislike crowds. Include food breaks and rain backup.", category: "Creative", accent: "#fb7185" },
  { id: "gal-17", title: "API design", blurb: "A small, honest API sketch.", seedIdea: "Sketch a REST API for a personal notes app: resources, auth assumptions, error shapes. No implementation code yet.", category: "Coding", accent: "#86efac" },
  { id: "gal-18", title: "Policy summary", blurb: "Plain-language policy notes.", seedIdea: "Summarize a remote-work policy for employees in plain English. Separate must / should / may. Flag ambiguities.", category: "Business", accent: "#e9d5ff" },
  { id: "gal-19", title: "Image brief", blurb: "Describe a visual for generation.", seedIdea: "Write an image-generation brief for a quiet ceramic workshop at dusk. Specify lighting, lens, palette, and what to avoid.", category: "Image", accent: "#fde047" },
  { id: "gal-20", title: "Video outline", blurb: "A 60-second explainer.", seedIdea: "Outline a 60-second explainer video on password managers. Beats, on-screen text, and one call to action. No fearmongering.", category: "Video", accent: "#67e8f9" },
  { id: "gal-21", title: "Refactor plan", blurb: "A safe stepwise refactor.", seedIdea: "Propose a stepwise refactor plan for a legacy React class component to hooks. Preserve behavior. List risks and tests.", category: "Coding", accent: "#c4b5fd" },
  { id: "gal-22", title: "Negotiation note", blurb: "A calm vendor email.", seedIdea: "Draft a vendor negotiation email asking for a 12% discount on annual SaaS. Firm but respectful. Offer a multi-year term.", category: "Business", accent: "#fca5a5" },
  { id: "gal-23", title: "Science demo", blurb: "A kitchen-table experiment.", seedIdea: "Design a safe kitchen experiment to show density for kids age 8–10. Materials list, steps, and what we hope to observe.", category: "Education", accent: "#bbf7d0" },
  { id: "gal-24", title: "Portfolio case", blurb: "Frame a design case study.", seedIdea: "Structure a portfolio case study for a banking app redesign: problem, constraints, process, outcome, and what I'd redo.", category: "Website / 3D", accent: "#fdba74" },
  { id: "gal-25", title: "Threat model", blurb: "Name risks without panic.", seedIdea: "Threat-model a browser extension that reads page text to build prompts. Assets, attackers, mitigations. Stay proportional.", category: "Coding", accent: "#fda4af" },
  { id: "gal-26", title: "Grant abstract", blurb: "A tight funding abstract.", seedIdea: "Write a 150-word grant abstract for a community tool library. Problem, approach, impact, and how success is measured.", category: "Writing", accent: "#93c5fd" },
  { id: "gal-27", title: "Onboarding", blurb: "First-run copy that respects people.", seedIdea: "Write first-run onboarding copy for SPE: three screens, no jargon, clear privacy line, one primary action each.", category: "Website / 3D", accent: "#a7f3d0" },
  { id: "gal-28", title: "Incident postmortem", blurb: "Blameless and useful.", seedIdea: "Draft a blameless incident postmortem template filled for a 22-minute API outage caused by a bad config push.", category: "Business", accent: "#fde68a" },
  { id: "gal-29", title: "Poem constraint", blurb: "Form first, feeling second.", seedIdea: "Write a 12-line poem about rain on metal roofs. Exact rhyme scheme AABB. No archaic diction.", category: "Creative", accent: "#fbcfe8" },
  { id: "gal-30", title: "Dataset questions", blurb: "Ask before you plot.", seedIdea: "List ten questions I should ask before analyzing a city open-data CSV of building permits. Cover quality, bias, and privacy.", category: "Analysis", accent: "#99f6e4" },
  { id: "gal-31", title: "Mobile nav", blurb: "IA for a small app.", seedIdea: "Propose information architecture for a habit tracker with five primary destinations. Justify what is not in the tab bar.", category: "Website / 3D", accent: "#d8b4fe" },
  { id: "gal-32", title: "Coach prompt", blurb: "A coach that asks well.", seedIdea: "Design a coaching prompt that helps me prepare a difficult feedback conversation. Ask clarifying questions before advice.", category: "AI Assistant", accent: "#6ee7b7" },
  { id: "gal-33", title: "Localization notes", blurb: "Copy that travels.", seedIdea: "Review this English UI string list for localization hazards: concatenated sentences, humor, gender, and date formats.", category: "Writing", accent: "#fdba74" },
  { id: "gal-34", title: "Energy budget", blurb: "A realistic week plan.", seedIdea: "Help me plan a low-energy work week with two deep-work blocks and hard stops. Chronic fatigue friendly. No hustle tone.", category: "Business", accent: "#bef264" },
  { id: "gal-35", title: "3D scene brief", blurb: "A quiet still-life stage.", seedIdea: "Brief a 3D still-life: brushed metal ring, frosted glass sphere, soft north light, graphite pedestal. Camera 50mm, f/4.", category: "Website / 3D", accent: "#7dd3fc" },
  { id: "gal-36", title: "Privacy notice", blurb: "Honest product privacy copy.", seedIdea: "Write a short privacy notice for a local-first prompt tool: what stays on device, what never leaves, and what is optional.", category: "Writing", accent: "#c4b5fd" },
];
