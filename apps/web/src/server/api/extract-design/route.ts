/**
 * Next.js Server Route Handler: /api/extract-design
 * Production extraction microservice powered by Playwright and UIDrop engine.
 */

import { extractDesignWithPlaywright } from "../../../engine/uidrop/playwrightExtractor";
import { extractDesignOffline } from "../../../engine/uidrop/extractorCore";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const { url, viewport, preferOffline } = body;

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'url' parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Execute Playwright extraction (or offline fallback)
    const snap = preferOffline
      ? extractDesignOffline(url)
      : await extractDesignWithPlaywright(url, { viewport });

    return new Response(JSON.stringify(snap), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to extract design system",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url") || "https://uidrop.studiocms.dev";
  const snap = extractDesignOffline(url);
  return new Response(JSON.stringify(snap), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
