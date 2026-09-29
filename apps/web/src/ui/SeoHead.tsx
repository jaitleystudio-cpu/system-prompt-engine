import { useEffect } from "react";
import {
  JSONLD_ELEMENT_ID,
  NOT_FOUND,
  NOT_FOUND_VIEW,
  OG_URL_SELECTOR,
  ROBOTS_META_KEY,
  jsonLdGraph,
} from "../search/foundation.mjs";
import { absoluteUrl, ROUTE_META, type AppView } from "../routing";

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

const RETIRED_JSON_LD = [
  "spe-jsonld-app",
  "spe-jsonld-capabilities-page",
  "spe-jsonld-capabilities-faq",
];

export function SeoHead({ view }: { view: AppView }) {
  useEffect(() => {
    const missing = view === NOT_FOUND_VIEW;
    const meta = missing
      ? {
          title: NOT_FOUND.title,
          description: NOT_FOUND.description,
          robots: NOT_FOUND.robotsMeta,
          path: "",
        }
      : ROUTE_META[view];
    const url = missing ? "" : absoluteUrl(meta.path);
    document.title = meta.title;
    upsertMeta("name", "description", meta.description);
    upsertMeta("name", ROBOTS_META_KEY, meta.robots);
    if (missing) removeLink("canonical");
    else upsertLink("canonical", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "SPE — System Prompt Engine");
    upsertMeta("property", "og:title", meta.title);
    upsertMeta("property", "og:description", meta.description);
    if (missing) {
      document.head.querySelector(OG_URL_SELECTOR)?.remove();
    } else {
      upsertMeta("property", "og:url", url);
      upsertMeta("property", "og:image", absoluteUrl("/art/intent-core.webp"));
    }
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", meta.title);
    upsertMeta("name", "twitter:description", meta.description);
    if (!missing) {
      upsertMeta(
        "name",
        "twitter:image",
        absoluteUrl("/art/intent-core.webp"),
      );
    }
    for (const id of RETIRED_JSON_LD) document.getElementById(id)?.remove();
    upsertJsonLd(JSONLD_ELEMENT_ID, jsonLdGraph(missing ? NOT_FOUND_VIEW : view));
  }, [view]);
  return null;
}
