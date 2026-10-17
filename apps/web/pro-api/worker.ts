// Cloudflare Workers entry (free plan, no card). NOT DEPLOYED: deploying needs founder authority.
// Configure with `wrangler secret put SPE_PRO_PUBLIC_KEYS` / `SPE_PRO_RELEASE_JWK`. Never set SPE_PRO_ALLOW_TEST_KEYS in production.
import { handleProRequest, type ProEnv } from "./handler.ts";
export default { fetch: (req: Request, env: ProEnv) => handleProRequest(req, env) };
