/**
 * Fail-closed linters for search signals.
 * Malformed robots, sitemap, canonical, and hreflang input is rejected.
 * These functions do not fetch.
 */

const DIRECTIVES = new Set(["user-agent", "allow", "disallow", "sitemap"]);

export function lintAbsoluteHttps(value) {
  const failures = [];
  let url;
  try {
    url = new URL(value);
  } catch {
    failures.push(`not a URL: ${value}`);
    return failures;
  }
  if (url.protocol !== "https:") failures.push(`not https: ${value}`);
  if (url.username || url.password) failures.push(`credentials: ${value}`);
  if (url.hash) failures.push(`fragment: ${value}`);
  return failures;
}

export function hasUserinfo(value) {
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password);
  } catch {
    return /:\/\/[^/\s]*@/.test(value);
  }
}

export function parseRobots(text) {
  const failures = [];
  const rules = [];
  const sitemaps = [];
  let sawAgent = false;
  const lines = String(text).split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z][A-Za-z-]*)\s*:\s*(.*)$/);
    if (!match) {
      failures.push(`line ${index + 1} malformed: ${line}`);
      continue;
    }
    const directive = match[1].toLowerCase();
    const value = match[2].trim();
    if (!DIRECTIVES.has(directive)) {
      failures.push(`line ${index + 1} unknown directive ${directive}`);
      continue;
    }
    if (directive === "user-agent") {
      if (!value) failures.push(`line ${index + 1} empty user-agent`);
      sawAgent = true;
      continue;
    }
    if (!sawAgent) failures.push(`line ${index + 1} directive before user-agent`);
    if (directive === "sitemap") {
      sitemaps.push(value);
      for (const problem of lintAbsoluteHttps(value)) {
        failures.push(`sitemap ${problem}`);
      }
      continue;
    }
    if (!value.startsWith("/")) {
      failures.push(`line ${index + 1} path must start with /`);
    }
    rules.push({ directive, path: value });
  }
  if (!sawAgent) failures.push("missing user-agent");
  return { failures, rules, sitemaps };
}

export function robotsDecision(rules, requestPath) {
  const matches = rules.filter((rule) => requestPath.startsWith(rule.path));
  if (matches.length === 0) return "allow";
  const longest = Math.max(...matches.map((rule) => rule.path.length));
  const top = matches.filter((rule) => rule.path.length === longest);
  if (
    top.some((rule) => rule.directive === "disallow") &&
    top.some((rule) => rule.directive === "allow")
  ) {
    return "allow";
  }
  return top[top.length - 1].directive === "disallow" ? "disallow" : "allow";
}

export function robotsFirstMatch(rules, requestPath) {
  const found = rules.find((rule) => requestPath.startsWith(rule.path));
  return found ? found.directive : "allow";
}

export function xmlWellFormed(source) {
  const failures = [];
  const stripped = String(source)
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const tags = [...stripped.matchAll(/<\/?([A-Za-z0-9:_-]+)([^>]*)>/g)];
  if (tags.length === 0) failures.push("no tags");
  const stack = [];
  for (const tag of tags) {
    const raw = tag[0];
    const name = tag[1];
    const closing = raw.startsWith("</");
    const selfClosing = /\/>$/.test(raw);
    if (closing) {
      const open = stack.pop();
      if (open !== name) failures.push(`mismatch ${open ?? "empty"} vs ${name}`);
    } else if (!selfClosing) {
      stack.push(name);
    }
  }
  if (stack.length) failures.push(`unclosed ${stack.join(",")}`);
  return failures;
}

export function sitemapLocs(source) {
  return [...String(source).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
}

export function lintSitemap(source) {
  const failures = [...xmlWellFormed(source)];
  if (!String(source).includes("<urlset")) failures.push("missing urlset");
  const locs = sitemapLocs(source);
  if (locs.length === 0) failures.push("no loc");
  for (const loc of locs) {
    for (const problem of lintAbsoluteHttps(loc)) failures.push(`loc ${problem}`);
  }
  return { failures, locs };
}

export function lintCanonicals(html) {
  const tags = [...String(html).matchAll(/<link\b[^>]*rel="canonical"[^>]*>/gi)].map(
    (match) => match[0],
  );
  const hrefs = [];
  const failures = [];
  if (tags.length > 1) failures.push("multiple canonicals");
  for (const tag of tags) {
    const href = tag.match(/href="([^"]*)"/);
    if (!href) {
      failures.push("canonical missing href");
      continue;
    }
    hrefs.push(href[1]);
    failures.push(...lintAbsoluteHttps(href[1]));
  }
  return { count: tags.length, hrefs, failures };
}

const HREFLANG = /^(?:x-default|[a-z]{2}(?:-[A-Z]{2})?)$/;

export function lintHreflang(html) {
  const failures = [];
  const tags = [...String(html).matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /rel="alternate"/.test(tag) && /hreflang=/.test(tag));
  for (const tag of tags) {
    const lang = tag.match(/hreflang="([^"]*)"/);
    const href = tag.match(/href="([^"]*)"/);
    if (!lang) failures.push("missing hreflang");
    else if (!HREFLANG.test(lang[1])) failures.push(`bad hreflang ${lang[1]}`);
    if (!href) failures.push("missing hreflang href");
    else failures.push(...lintAbsoluteHttps(href[1]));
  }
  return { count: tags.length, failures };
}

export function collectTypes(value, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, out);
    return out;
  }
  if (typeof value["@type"] === "string") out.push(value["@type"]);
  for (const nested of Object.values(value)) collectTypes(nested, out);
  return out;
}

export function titleOf(html) {
  const match = String(html).match(/<title>([^<]*)<\/title>/);
  return match ? match[1] : null;
}

export function metaContent(html, attr, key) {
  const match = String(html).match(
    new RegExp(`<meta ${attr}="${key}" content="([^"]*)" />`),
  );
  return match ? match[1] : null;
}

export function parseRedirects(text) {
  const failures = [];
  const rules = [];
  const lines = String(text).split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length !== 3) {
      failures.push(`redirect line ${index + 1} malformed`);
      continue;
    }
    const status = Number(parts[2]);
    if (!Number.isInteger(status)) failures.push(`redirect line ${index + 1} status`);
    rules.push({ from: parts[0], to: parts[1], status });
  }
  return { failures, rules };
}

export function redirectCycle(rules) {
  const edges = new Map();
  for (const rule of rules) {
    if (rule.from.includes("*") || rule.to.includes("*") || rule.to.includes(":")) continue;
    const list = edges.get(rule.from) ?? [];
    list.push(rule.to);
    edges.set(rule.from, list);
  }
  const state = new Map();
  function visit(node, trail) {
    if (state.get(node) === 1) return true;
    if (state.get(node) === 2) return false;
    state.set(node, 1);
    for (const next of edges.get(node) ?? []) {
      if (visit(next, trail)) return true;
    }
    state.set(node, 2);
    return false;
  }
  for (const node of edges.keys()) {
    if (visit(node)) return true;
  }
  return false;
}
