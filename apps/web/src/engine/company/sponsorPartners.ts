/**
 * Sponsored developer partners registry.
 * Maintained in engine/ to isolate third-party commercial partner metadata from static UI copy.
 */

export interface SponsorPartner {
  name: string;
  tagline: string;
  url: string;
  badge: string;
}

export const SPONSORS: SponsorPartner[] = [
  {
    name: "Groq LPU Inference",
    tagline: "Ultra high-speed AI inference at 500+ tokens/sec. Instant prompt execution.",
    url: "https://groq.com",
    badge: "Speed Partner",
  },
  {
    name: "Cursor AI Code Editor",
    tagline: "The AI-first code editor built for hyper-productive software engineering.",
    url: "https://cursor.com",
    badge: "Editor Partner",
  },
  {
    name: "Neon Serverless Postgres",
    tagline: "Serverless Postgres built for scale. Branch your database like code.",
    url: "https://neon.tech",
    badge: "Database Partner",
  },
  {
    name: "Cloudflare Workers",
    tagline: "Deploy serverless code instantly across 300+ cities with zero cold starts.",
    url: "https://workers.cloudflare.com",
    badge: "Compute Partner",
  },
  {
    name: "Vercel AI SDK",
    tagline: "The open source TypeScript library for building conversational web interfaces.",
    url: "https://sdk.vercel.ai",
    badge: "Framework Partner",
  },
];
