import { useEffect } from "react";
import {
  absoluteUrl,
  jsonLdCapabilitiesFaq,
  jsonLdCapabilitiesWebPage,
  jsonLdSoftwareApplication,
  ROUTE_META,
  type AppView,
} from "../routing";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(
    `meta[${attr}="${key}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(
    `link[rel="${rel}"]`,
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeLink(rel: string) {
  document.head.querySelector(`link[rel="${rel}"]`)?.remove();
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove();
}

export function SeoHead({
  view,
  unlisted = false,
  notFound = false,
}: {
  view: AppView;
  /** Private or unknown routes must not be indexed. */
  unlisted?: boolean;
  notFound?: boolean;
}) {
  useEffect(() => {
    const meta = ROUTE_META[view];
    const privateSurface = unlisted || notFound || view === "workspace";
    const title = notFound ? "Page not found — SPE" : meta.title;
    const description = notFound
      ? "That address is not a page in this preview."
      : meta.description;
    const url = absoluteUrl(meta.path);
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta(
      "name",
      "robots",
      privateSurface ? "noindex, nofollow" : "index, follow",
    );
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "SPE — System Prompt Engine");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (privateSurface) {
      removeLink("canonical");
      removeMeta("property", "og:url");
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
      removeJsonLd("spe-jsonld-app");
    } else {
      upsertLink("canonical", url);
      upsertMeta("property", "og:url", url);
      upsertMeta("property", "og:image", absoluteUrl("/art/intent-core.webp"));
      upsertMeta("name", "twitter:image", absoluteUrl("/art/intent-core.webp"));
      upsertJsonLd("spe-jsonld-app", jsonLdSoftwareApplication());
    }
    if (view === "capabilities" && !privateSurface) {
      upsertJsonLd("spe-jsonld-capabilities-page", jsonLdCapabilitiesWebPage());
      upsertJsonLd("spe-jsonld-capabilities-faq", jsonLdCapabilitiesFaq());
    } else {
      removeJsonLd("spe-jsonld-capabilities-page");
      removeJsonLd("spe-jsonld-capabilities-faq");
    }
  }, [view, unlisted, notFound]);
  return null;
}
