# Search Console readiness pack

This folder prepares crawl and index files for a future public host. It does not submit a property, add DNS, or deploy the site.

## Status

- Hosting: not authorized
- Search Console submission: do not submit
- Verification token: none (`property.json` keeps `verification` null)
- Canonical host recorded for a later unlock: `https://systempromptengine.com/`

## What is ready

- `property.json` — property URL, sitemap path, robots path, and the do-not-submit flag
- `coverage.json` — URLs that belong in the index, URLs that stay noindex, and the 404 contract
- `prerender/` — standalone HTML for each public route and the 404, readable without JavaScript

The live files a future host would serve are generated from the same registry:

- `apps/web/public/robots.txt`
- `apps/web/public/sitemap.xml`
- `apps/web/public/404.html`
- `apps/web/public/search/public-index.json`
- `apps/web/public/search/private-noindex.json`
- `apps/web/public/_redirects` (known routes stay 200; unknown URLs return 404)

Regenerate them with `npm run search:emit` from `apps/web`. Do not run a host, a DNS change, or a Search Console API call from this pack.
