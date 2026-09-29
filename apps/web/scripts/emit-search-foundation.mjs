#!/usr/bin/env node
/**
 * Writes crawl artifacts from the search registry.
 * Does not deploy, change DNS, or contact a host.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEARCH_REVISION,
  SITE_ORIGIN,
  coverageExpectations,
  injectDocument,
  privateNoindexRegistry,
  publicIndexRegistry,
  publicIndexRoutes,
  renderRedirects,
  renderRobotsTxt,
  renderSitemapXml,
  renderStandaloneDocument,
} from "../src/search/foundation.mjs";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(webRoot, "public");
const searchDir = join(publicDir, "search");
const packDir = join(webRoot, "search-console");
const snapshotDir = join(packDir, "prerender");

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

const indexPath = join(webRoot, "index.html");
const indexHtml = readFileSync(indexPath, "utf8");
write(indexPath, injectDocument(indexHtml, "home"));

write(join(publicDir, "robots.txt"), renderRobotsTxt());
write(join(publicDir, "sitemap.xml"), renderSitemapXml());
write(join(publicDir, "404.html"), renderStandaloneDocument("not-found"));
write(join(publicDir, "_redirects"), renderRedirects());
write(
  join(searchDir, "public-index.json"),
  `${JSON.stringify(publicIndexRegistry(), null, 2)}\n`,
);
write(
  join(searchDir, "private-noindex.json"),
  `${JSON.stringify(privateNoindexRegistry(), null, 2)}\n`,
);

for (const route of publicIndexRoutes()) {
  const name = route.path === "/" ? "home.html" : `${route.id}.html`;
  write(join(snapshotDir, name), renderStandaloneDocument(route.id));
}
write(join(snapshotDir, "not-found.html"), renderStandaloneDocument("not-found"));

write(
  join(packDir, "coverage.json"),
  `${JSON.stringify(coverageExpectations(), null, 2)}\n`,
);
write(
  join(packDir, "property.json"),
  `${JSON.stringify(
    {
      property: `${SITE_ORIGIN}/`,
      status: "NOT_SUBMITTED",
      hosting: "NOT_AUTHORIZED",
      verification: null,
      doNotSubmit: true,
      revision: SEARCH_REVISION,
      sitemapPath: "/sitemap.xml",
      robotsPath: "/robots.txt",
      publicIndexPath: "/search/public-index.json",
      privateNoindexPath: "/search/private-noindex.json",
      note: "Prepared for a future unlock. Do not add DNS, do not deploy, and do not submit this property.",
    },
    null,
    2,
  )}\n`,
);

console.log(`search foundation emitted at revision ${SEARCH_REVISION}`);
