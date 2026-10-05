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
  }

  return { safe: true };
}
