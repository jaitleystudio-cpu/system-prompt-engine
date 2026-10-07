/**
 * SSRF Security Validator for URL ingestion.
 *
 * Implements strict SSRF boundaries:
 * - Protocols: http:, https: only
 * - Rejects credentials in URL (username or password)
 * - Restricts to approved web ports (80, 443)
 * - Rejects loopback, private RFC 1918, link-local, multicast, and reserved IPv4 ranges
 * - Rejects IPv6 loopback, unspecified, private, link-local, multicast, and IPv4-mapped IPv6
 * - Rejects cloud metadata hosts (metadata.google.internal, instance-data, metadata, etc.)
 */

function isPrivateIpv4Octets(octets: number[]): { isPrivate: boolean; reason?: string } {
  const [a, b, c] = octets;
  if (a === 0) return { isPrivate: true, reason: "PRIVATE_IP_ZERO" };
  if (a === 127) return { isPrivate: true, reason: "LOOPBACK_IP" };
  if (a === 10) return { isPrivate: true, reason: "PRIVATE_IP_10" };
  if (a === 172 && b >= 16 && b <= 31) return { isPrivate: true, reason: "PRIVATE_IP_172" };
  if (a === 192 && b === 168) return { isPrivate: true, reason: "PRIVATE_IP_192" };
  if (a === 169 && b === 254) return { isPrivate: true, reason: "METADATA_LINK_LOCAL_IP" };
  if (a === 100 && b >= 64 && b <= 127) return { isPrivate: true, reason: "SHARED_CGNAT_IP" };
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return { isPrivate: true, reason: "RESERVED_IP" };
  if (a === 198 && b === 51 && c === 100) return { isPrivate: true, reason: "TEST_NET_IP" };
  if (a === 203 && b === 0 && c === 113) return { isPrivate: true, reason: "TEST_NET_IP" };
  if (a === 198 && (b === 18 || b === 19)) return { isPrivate: true, reason: "BENCHMARK_NET_IP" };
  if (a >= 224 && a <= 239) return { isPrivate: true, reason: "MULTICAST_IP" };
  if (a >= 240) return { isPrivate: true, reason: "RESERVED_IP" };
  return { isPrivate: false };
}

export function isSsrfSafeUrl(url: URL): { safe: boolean; reason?: string } {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: "UNSUPPORTED_PROTOCOL" };
  }

  // Reject embedded credentials in URL
  if (url.username || url.password) {
    return { safe: false, reason: "CREDENTIALS_IN_URL" };
  }

  // Approved web ports only
  const port = url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80);
  if (port !== 80 && port !== 443) {
    return { safe: false, reason: "NON_APPROVED_PORT" };
  }

  const hostname = url.hostname.toLowerCase().trim();
  if (!hostname) {
    return { safe: false, reason: "EMPTY_HOSTNAME" };
  }

  // Trailing dot check
  const cleanHost = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;

  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost === "metadata.google.internal" ||
    cleanHost === "metadata" ||
    cleanHost === "instance-data" ||
    cleanHost.endsWith(".internal") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".invalid") ||
    cleanHost.endsWith(".test") ||
    cleanHost.endsWith(".example")
  ) {
    return { safe: false, reason: "LOCAL_OR_METADATA_HOST" };
  }

  // IPv4 dotted-decimal
  const ipv4Match = cleanHost.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => o < 0 || o > 255)) {
      return { safe: false, reason: "INVALID_IP" };
    }
    const check = isPrivateIpv4Octets(octets);
    if (check.isPrivate) {
      return { safe: false, reason: check.reason };
    }
  }

  // IPv6 handling
  const isIpv6 = cleanHost.startsWith("[") && cleanHost.endsWith("]");
  const rawIpv6 = isIpv6 ? cleanHost.slice(1, -1).toLowerCase() : cleanHost;

  if (isIpv6 || rawIpv6.includes(":")) {
    // Unspecified & Loopback
    if (
      rawIpv6 === "::" ||
      rawIpv6 === "::1" ||
      rawIpv6 === "0:0:0:0:0:0:0:0" ||
      rawIpv6 === "0:0:0:0:0:0:0:1" ||
      rawIpv6.endsWith("::1")
    ) {
      return { safe: false, reason: "LOOPBACK_OR_UNSPECIFIED_IPV6" };
    }

    // Link-local: fe80::/10
    if (/^fe[89ab][0-9a-f]?:/i.test(rawIpv6)) {
      return { safe: false, reason: "LINK_LOCAL_IPV6" };
    }

    // Unique local / private: fc00::/7 (fc.. or fd..)
    if (rawIpv6.startsWith("fc") || rawIpv6.startsWith("fd")) {
      return { safe: false, reason: "PRIVATE_IPV6" };
    }

    // Multicast: ff00::/8
    if (rawIpv6.startsWith("ff")) {
      return { safe: false, reason: "MULTICAST_IPV6" };
    }

    // IPv4-mapped IPv6: ::ffff:x.x.x.x
    const mappedIpv4Dotted = rawIpv6.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mappedIpv4Dotted) {
      const octets = mappedIpv4Dotted[1].split(".").map(Number);
      if (octets.every((o) => o >= 0 && o <= 255)) {
        const check = isPrivateIpv4Octets(octets);
        if (check.isPrivate) {
          return { safe: false, reason: `IPV4_MAPPED_${check.reason}` };
        }
      }
    }

    // IPv4-mapped IPv6 in hex: ::ffff:hhhh:hhhh
    const mappedIpv4Hex = rawIpv6.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedIpv4Hex) {
      const h1 = parseInt(mappedIpv4Hex[1], 16);
      const h2 = parseInt(mappedIpv4Hex[2], 16);
      const octets = [(h1 >> 8) & 0xff, h1 & 0xff, (h2 >> 8) & 0xff, h2 & 0xff];
      const check = isPrivateIpv4Octets(octets);
      if (check.isPrivate) {
        return { safe: false, reason: `IPV4_MAPPED_${check.reason}` };
      }
    }

    // Documentation: 2001:db8::/32
    if (rawIpv6.startsWith("2001:db8:") || rawIpv6.startsWith("2001:0db8:")) {
      return { safe: false, reason: "DOCUMENTATION_IPV6" };
    }

    // SPE-R9-G repair: full 128-bit classification closes lexical gaps the
    // prefix checks above miss (IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::/96,
    // 6to4 2002::/16, IPv4-translated ::ffff:0:0/96, Teredo, non-global).
    const literalCheck = classifyIpAddress(rawIpv6);
    if (literalCheck.family !== 6 || literalCheck.forbidden) {
      return { safe: false, reason: literalCheck.reason || "INVALID_IPV6" };
    }
  }

  return { safe: true };
}


// ===========================================================================
// SPE-R9-G repair — network execution-boundary primitives.
//
// Lexical URL validation (isSsrfSafeUrl) cannot see what a hostname resolves
// to, nor where a redirect goes. These primitives move enforcement to the
// execution boundary:
//   * classifyIpAddress      — forbidden-class check for a concrete address
//                              (resolver output or IP literal).
//   * resolveAndValidateHost — trusted-resolver hook; every A/AAAA answer
//                              must be public; failure / empty fails closed.
//   * guardedPublicFetch     — manual redirect walk: every hop is validated
//                              (lexical + resolved) BEFORE it is requested.
//
// Honesty constraints:
//   * Browser fetch exposes neither the resolved nor the connected IP, and
//     hides redirect Location headers (opaqueredirect). In a browser the
//     destination identity is UNVERIFIED; opaque redirects fail closed.
//   * Standard fetch cannot pin a connection to a pre-validated address, so
//     resolution-time validation alone leaves a DNS-rebinding TOCTOU window.
//     Only a transport that declares pinsResolvedAddress=true satisfies
//     REQUIRE_PINNED_RESOLUTION (the default, fail-closed policy).
// ===========================================================================

export type AddressClassification = {
  family: 0 | 4 | 6;
  forbidden: boolean;
  reason?: string;
};

function parseStrictIpv4(text: string): number[] | null {
  const m = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) return null;
  // Reject leading-zero octets (octal ambiguity) in resolver output.
  if (m.slice(1, 5).some((o) => o.length > 1 && o.startsWith("0"))) return null;
  return octets;
}

function parseIpv6Hextets(text: string): number[] | null {
  let raw = text.trim().toLowerCase();
  if (raw.startsWith("[") && raw.endsWith("]")) raw = raw.slice(1, -1);
  const zone = raw.indexOf("%");
  if (zone !== -1) raw = raw.slice(0, zone);
  if (!raw.includes(":")) return null;
  let tail: number[] = [];
  const lastColon = raw.lastIndexOf(":");
  const maybeV4 = raw.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const v4 = parseStrictIpv4(maybeV4);
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    raw = raw.slice(0, lastColon + 1) + "0:0";
  }
  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const parseGroup = (g: string): number[] | null => {
    if (g === "") return [];
    const parts = g.split(":");
    const out: number[] = [];
    for (const part of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };
  const head = parseGroup(halves[0]);
  const rest = halves.length === 2 ? parseGroup(halves[1]) : [];
  if (!head || !rest) return null;
  let hextets: number[];
  if (halves.length === 2) {
    const fill = 8 - head.length - rest.length;
    if (fill < 1) return null;
    hextets = [...head, ...new Array(fill).fill(0), ...rest];
  } else {
    hextets = head;
  }
  if (hextets.length !== 8) return null;
  if (tail.length) {
    hextets[6] = tail[0];
    hextets[7] = tail[1];
  }
  return hextets;
}

function embeddedIpv4(hi: number, lo: number): number[] {
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
}

/**
 * Classify a concrete IP address (resolver output or bracket-stripped literal).
 * Fail-closed: anything unparseable is forbidden. IPv6 is allow-listed to
 * global unicast 2000::/3 minus embedded/private/documentation forms.
 */
export function classifyIpAddress(address: string): AddressClassification {
  if (typeof address !== "string" || !address.trim()) {
    return { family: 0, forbidden: true, reason: "ADDRESS_UNPARSEABLE" };
  }
  const v4 = parseStrictIpv4(address.trim());
  if (v4) {
    const check = isPrivateIpv4Octets(v4);
    if (check.isPrivate) return { family: 4, forbidden: true, reason: check.reason };
    if (v4[0] === 192 && v4[1] === 88 && v4[2] === 99) {
      return { family: 4, forbidden: true, reason: "RESERVED_IP" };
    }
    return { family: 4, forbidden: false };
  }
  const h = parseIpv6Hextets(address);
  if (!h) return { family: 0, forbidden: true, reason: "ADDRESS_UNPARSEABLE" };
  const zeroUpTo = (n: number) => h.slice(0, n).every((x) => x === 0);
  if (h.every((x) => x === 0)) return { family: 6, forbidden: true, reason: "UNSPECIFIED_IPV6" };
  if (zeroUpTo(7) && h[7] === 1) return { family: 6, forbidden: true, reason: "LOOPBACK_IPV6" };
  if (zeroUpTo(5) && h[5] === 0xffff) {
    const check = isPrivateIpv4Octets(embeddedIpv4(h[6], h[7]));
    return check.isPrivate
      ? { family: 6, forbidden: true, reason: `IPV4_MAPPED_${check.reason}` }
      : { family: 6, forbidden: false };
  }
  if (zeroUpTo(6)) return { family: 6, forbidden: true, reason: "IPV4_COMPATIBLE_IPV6" };
  if (zeroUpTo(4) && h[4] === 0xffff && h[5] === 0) {
    return { family: 6, forbidden: true, reason: "IPV4_TRANSLATED_IPV6" };
  }
  if (h[0] === 0x64 && h[1] === 0xff9b) {
    if (h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
      const check = isPrivateIpv4Octets(embeddedIpv4(h[6], h[7]));
      return check.isPrivate
        ? { family: 6, forbidden: true, reason: `NAT64_${check.reason}` }
        : { family: 6, forbidden: false };
    }
    return { family: 6, forbidden: true, reason: "NAT64_LOCAL_USE_IPV6" };
  }
  if ((h[0] & 0xfe00) === 0xfc00) return { family: 6, forbidden: true, reason: "PRIVATE_IPV6" };
  if ((h[0] & 0xffc0) === 0xfe80) return { family: 6, forbidden: true, reason: "LINK_LOCAL_IPV6" };
  if ((h[0] & 0xffc0) === 0xfec0) return { family: 6, forbidden: true, reason: "SITE_LOCAL_IPV6" };
  if ((h[0] & 0xff00) === 0xff00) return { family: 6, forbidden: true, reason: "MULTICAST_IPV6" };
  if (h[0] === 0x2001 && h[1] === 0x0db8) return { family: 6, forbidden: true, reason: "DOCUMENTATION_IPV6" };
  if (h[0] === 0x2001 && h[1] === 0) return { family: 6, forbidden: true, reason: "TEREDO_IPV6" };
  if (h[0] === 0x3fff && (h[1] & 0xf000) === 0) return { family: 6, forbidden: true, reason: "DOCUMENTATION_IPV6" };
  if (h[0] === 0x2002) {
    const check = isPrivateIpv4Octets(embeddedIpv4(h[1], h[2]));
    return check.isPrivate
      ? { family: 6, forbidden: true, reason: `SIX_TO_FOUR_${check.reason}` }
      : { family: 6, forbidden: false };
  }
  if ((h[0] & 0xe000) !== 0x2000) return { family: 6, forbidden: true, reason: "NON_GLOBAL_IPV6" };
  return { family: 6, forbidden: false };
}

export type TrustedHostResolver = (hostname: string) => Promise<readonly string[]>;

export type HostValidation =
  | { ok: true; addresses: string[]; literal: boolean }
  | { ok: false; reason: string };

function bareHost(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

/**
 * Resolve a hostname with a TRUSTED resolver and require every answer to be
 * a public address. Resolver failure, empty answers, unparseable answers, or
 * any forbidden answer (mixed public/private) all fail closed.
 */
export async function resolveAndValidateHost(
  hostname: string,
  resolver: TrustedHostResolver | undefined,
): Promise<HostValidation> {
  const host = bareHost(hostname);
  if (!host) return { ok: false, reason: "EMPTY_HOSTNAME" };
  const literal = classifyIpAddress(host);
  if (literal.family !== 0) {
    return literal.forbidden
      ? { ok: false, reason: `LITERAL_${literal.reason}` }
      : { ok: true, addresses: [host], literal: true };
  }
  if (!resolver) return { ok: false, reason: "TRUSTED_RESOLVER_UNAVAILABLE" };
  let answers: readonly string[];
  try {
    answers = await resolver(host);
  } catch {
    return { ok: false, reason: "DNS_RESOLUTION_FAILED" };
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return { ok: false, reason: "DNS_NO_ADDRESSES" };
  }
  for (const answer of answers) {
    const check = classifyIpAddress(String(answer));
    if (check.forbidden) return { ok: false, reason: `RESOLVED_${check.reason}` };
  }
  return { ok: true, addresses: answers.map(String), literal: false };
}

export const DestinationPolicies = Object.freeze({
  /** Default. Resolve with trusted resolver AND connect via a pinning transport. */
  REQUIRE_PINNED_RESOLUTION: "REQUIRE_PINNED_RESOLUTION",
  /** Resolve with trusted resolver; transport may re-resolve (TOCTOU disclosed). */
  REQUIRE_RESOLUTION: "REQUIRE_RESOLUTION",
  /** Browser: no resolver and no connected-IP visibility. Lexical + per-hop only. */
  BROWSER_UNVERIFIABLE: "BROWSER_UNVERIFIABLE",
} as const);
export type DestinationPolicy =
  (typeof DestinationPolicies)[keyof typeof DestinationPolicies];

export type DestinationIdentity =
  | "IP_LITERAL"
  | "RESOLVED_AND_PINNED"
  | "RESOLVED_NOT_PINNED"
  | "UNVERIFIED_BROWSER";

export type BoundaryTransport = {
  /** True only if request() connects to exactly `pinnedAddress` when given. */
  pinsResolvedAddress: boolean;
  request: (
    url: string,
    init: RequestInit,
    pinnedAddress: string | null,
  ) => Promise<Response>;
};

export type BoundaryHop = {
  url: string;
  host: string;
  addresses: string[];
  identity: DestinationIdentity;
  status?: number;
};

export type GuardedFetchResult =
  | {
      ok: true;
      response: Response;
      finalUrl: string;
      hops: BoundaryHop[];
      destinationIdentity: DestinationIdentity;
    }
  | { ok: false; reason: string; refusedUrl: string; hops: BoundaryHop[] };

export const MAX_BOUNDARY_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Refusals caused by browser opacity rather than a proven-unsafe target. */
export function isUnverifiableDestinationRefusal(reason: string): boolean {
  return (
    reason === "REDIRECT_DESTINATION_UNVERIFIABLE" ||
    reason === "TRUSTED_RESOLVER_UNAVAILABLE" ||
    reason === "DESTINATION_BINDING_UNVERIFIABLE"
  );
}

function defaultTransport(): BoundaryTransport {
  return {
    pinsResolvedAddress: false,
    request: (url, init) => fetch(url, init),
  };
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Execution-boundary fetch: validates the initial URL and EVERY redirect hop
 * (lexically and, when a trusted resolver is supplied, by resolved address)
 * BEFORE the hop is requested. Never lets the transport follow redirects.
 * AbortError / transport errors propagate to the caller unchanged.
 */
export async function guardedPublicFetch(
  rawUrl: string,
  opts: {
    transport?: BoundaryTransport;
    resolveHost?: TrustedHostResolver;
    policy?: DestinationPolicy;
    maxRedirects?: number;
    init?: RequestInit;
  } = {},
): Promise<GuardedFetchResult> {
  const transport = opts.transport ?? defaultTransport();
  const policy = opts.policy ?? DestinationPolicies.REQUIRE_PINNED_RESOLUTION;
  const maxRedirects = opts.maxRedirects ?? MAX_BOUNDARY_REDIRECTS;
  const hops: BoundaryHop[] = [];
  let current = rawUrl;
  for (let redirects = 0; ; redirects += 1) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { ok: false, reason: "URL_UNPARSEABLE", refusedUrl: current, hops };
    }
    const lexical = isSsrfSafeUrl(parsed);
    if (!lexical.safe) {
      return {
        ok: false,
        reason: `LEXICAL_${lexical.reason || "UNSAFE"}`,
        refusedUrl: parsed.toString(),
        hops,
      };
    }
    const host = bareHost(parsed.hostname);
    let identity: DestinationIdentity;
    let addresses: string[] = [];
    let pinned: string | null = null;
    const literal = classifyIpAddress(host);
    if (literal.family !== 0) {
      if (literal.forbidden) {
        return {
          ok: false,
          reason: `LITERAL_${literal.reason}`,
          refusedUrl: parsed.toString(),
          hops,
        };
      }
      identity = "IP_LITERAL";
      addresses = [host];
      pinned = host;
    } else if (opts.resolveHost) {
      const resolved = await resolveAndValidateHost(host, opts.resolveHost);
      if (!resolved.ok) {
        return { ok: false, reason: resolved.reason, refusedUrl: parsed.toString(), hops };
      }
      addresses = resolved.addresses;
      if (transport.pinsResolvedAddress) {
        identity = "RESOLVED_AND_PINNED";
        pinned = addresses[0];
      } else if (policy === DestinationPolicies.REQUIRE_PINNED_RESOLUTION) {
        return {
          ok: false,
          reason: "DESTINATION_BINDING_UNVERIFIABLE",
          refusedUrl: parsed.toString(),
          hops,
        };
      } else {
        identity = "RESOLVED_NOT_PINNED";
      }
    } else if (policy === DestinationPolicies.BROWSER_UNVERIFIABLE) {
      identity = "UNVERIFIED_BROWSER";
    } else {
      return {
        ok: false,
        reason: "TRUSTED_RESOLVER_UNAVAILABLE",
        refusedUrl: parsed.toString(),
        hops,
      };
    }

    const hop: BoundaryHop = { url: parsed.toString(), host, addresses, identity };
    hops.push(hop);
    const response = await transport.request(
      parsed.toString(),
      { ...(opts.init || {}), redirect: "manual" },
      pinned,
    );
    hop.status = response.status;

    if (response.type === "opaqueredirect") {
      await discardBody(response);
      return {
        ok: false,
        reason: "REDIRECT_DESTINATION_UNVERIFIABLE",
        refusedUrl: parsed.toString(),
        hops,
      };
    }
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await discardBody(response);
      if (!location) {
        return { ok: false, reason: "REDIRECT_LOCATION_MISSING", refusedUrl: parsed.toString(), hops };
      }
      if (redirects + 1 > maxRedirects) {
        return { ok: false, reason: "REDIRECT_LIMIT_EXCEEDED", refusedUrl: parsed.toString(), hops };
      }
      try {
        current = new URL(location, parsed).toString();
      } catch {
        return { ok: false, reason: "REDIRECT_LOCATION_UNPARSEABLE", refusedUrl: location, hops };
      }
      continue;
    }
    return {
      ok: true,
      response,
      finalUrl: parsed.toString(),
      hops,
      destinationIdentity: identity,
    };
  }
}
