import type { UrlIngestResult } from "./types";

const FALLBACKS = [
  "Paste the page text into the composer",
  "Upload a screenshot of the page",
  "Upload a saved HTML file",
  "Write a short description of the site",
];

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function extractBetween(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** CORS-honest ingest. Never uses a paid proxy. */
export async function ingestUrl(rawUrl: string): Promise<UrlIngestResult> {
  const parsed = normalizeUrl(rawUrl);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return {
      status: "invalid_url",
      url: rawUrl,
      message: "Enter a full http(s) URL.",
      fallbacks: FALLBACKS,
    };
  }

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (!res.ok) {
      return {
        status: "network_error",
        url: parsed.toString(),
        message: `The site responded with HTTP ${res.status}. SPE did not use a proxy.`,
        fallbacks: FALLBACKS,
      };
    }
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    const limited = text.slice(0, 200_000);
    if (/html/i.test(ctype) || /<html/i.test(limited)) {
      const title =
        extractBetween(limited, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
        extractBetween(
          limited,
          /property=["']og:title["'][^>]*content=["']([^"']+)/i,
        );
      const description =
        extractBetween(
          limited,
          /name=["']description["'][^>]*content=["']([^"']+)/i,
        ) ||
        extractBetween(
          limited,
          /property=["']og:description["'][^>]*content=["']([^"']+)/i,
        );
      return {
        status: "ok",
        url: parsed.toString(),
        title,
        description,
        textExcerpt: stripTags(limited).slice(0, 4000),
        notes: [
          "Fetched directly from your browser (CORS permitted).",
          "No CORS proxy was used.",
          `Content-Type: ${ctype || "unknown"}`,
        ],
      };
    }
    return {
      status: "ok",
      url: parsed.toString(),
      title: null,
      description: null,
      textExcerpt: stripTags(limited).slice(0, 4000),
      notes: ["Fetched as non-HTML text.", "No CORS proxy was used."],
    };
  } catch {
    return {
      status: "cors_blocked",
      url: parsed.toString(),
      message:
        "This browser could not read that URL (likely CORS or network). SPE will not use a paid proxy.",
      fallbacks: FALLBACKS,
    };
  }
}

export function urlResultToPromptBlock(result: UrlIngestResult): string {
  if (result.status !== "ok") {
    return [
      "URL ingest could not complete:",
      `- URL: ${result.url}`,
      `- Status: ${result.status}`,
      `- Message: ${result.message}`,
      `- Fallbacks: ${result.fallbacks.join("; ")}`,
    ].join("\n");
  }
  return [
    "URL observations (direct browser fetch, no proxy):",
    `- URL: ${result.url}`,
    result.title ? `- Title: ${result.title}` : null,
    result.description ? `- Description: ${result.description}` : null,
    `- Notes: ${result.notes.join(" ")}`,
    `- Excerpt: ${result.textExcerpt.slice(0, 2500)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function ingestHtmlFile(file: File): Promise<UrlIngestResult> {
  const text = (await file.text()).slice(0, 200_000);
  const title = extractBetween(text, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extractBetween(
    text,
    /name=["']description["'][^>]*content=["']([^"']+)/i,
  );
  return {
    status: "ok",
    url: `file://${file.name}`,
    title,
    description,
    textExcerpt: stripTags(text).slice(0, 4000),
    notes: [
      "Loaded from a local HTML file upload.",
      "No network request was made.",
    ],
  };
}
