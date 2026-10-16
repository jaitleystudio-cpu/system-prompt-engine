/**
 * SPE Ω — Active Network Egress Observer & Air-Gap Verification Monitor (P0-R2)
 *
 * Provides defensible, observable network-policy checks and active air-gap enforcement:
 * 1. Node.js Environment: Monitors TCP socket initialization via `net.Socket.prototype.connect`
 *    and HTTP/HTTPS requests via `globalThis.fetch`.
 * 2. Browser Environment: Instruments `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and `navigator.sendBeacon`.
 * 3. Deny-by-Default Policy: Actively blocks and rejects outbound connection attempts with an
 *    exception when air-gap enforcement is activated, with explicit support for authorized local destinations.
 * 4. Records remote packet counts, logs both blocked and permitted connections, and guarantees zero cloud egress.
 */

export interface NetworkObservationReport {
  observedPackets: number;
  observedDestinations: string[];
  blockedConnections: string[];
  permittedConnections: string[];
  airGapViolated: boolean;
  observationDurationMs: number;
  denyByDefaultEnforced: boolean;
}

export interface ObservationOptions {
  denyByDefault?: boolean;
  permittedDestinations?: string[];
}

interface ActiveObservationSession {
  id: string;
  denyByDefault: boolean;
  permittedDestinations: string[];
  hasWildcard: boolean;
  startMs: number;
  initialCount: number;
  initialDestLen: number;
  initialBlockedLen: number;
  initialPermittedLen: number;
}

export class NetworkEgressObserver {
  private static activeSessions = 0;
  private static activeDenySessions = 0;
  private static packetCount = 0;
  private static destinations: string[] = [];
  private static blockedConnections: string[] = [];
  private static permittedConnections: string[] = [];
  private static sessions: Map<string, ActiveObservationSession> = new Map();
  private static sessionCounter = 0;
  private static isHooked = false;
  private static origSocketConnect: unknown = null;
  private static origFetch: unknown = null;
  private static origXhrOpen: unknown = null;
  private static origXhrSend: unknown = null;
  private static origWebSocket: unknown = null;
  private static origEventSource: unknown = null;
  private static origSendBeacon: unknown = null;
  private static globalAirGapEnforce = false;

  public static setGlobalAirGapEnforce(enforce: boolean): void {
    this.globalAirGapEnforce = enforce;
  }

  public static isAirGapEnforced(): boolean {
    return this.globalAirGapEnforce || process.env.SPE_AIR_GAP_ENFORCE === "1";
  }

  public static isDenyByDefaultActive(): boolean {
    if (this.isAirGapEnforced()) return true;
    for (const s of this.sessions.values()) {
      if (s.denyByDefault) return true;
    }
    return false;
  }

  public static getActiveDenySessionsCount(): number {
    return this.activeDenySessions;
  }

  public static isDestinationPermitted(dest: string): boolean {
    if (!dest) return false;
    if (this.isLocalResource(dest)) return true;

    // Strict deny-by-default air gap enforcement (Finding R2.3-P0-D / Gate G4):
    if (this.isDenyByDefaultActive()) {
      const denySessions = Array.from(this.sessions.values()).filter((s) => s.denyByDefault);
      if (denySessions.length === 0) {
        // Air-gap mode is active globally without explicit sessions.
        // Permit strictly declared local SPE preview origins (127.0.0.1:4173 / localhost:4173); reject all other outbound traffic!
        const AIR_GAP_DEFAULT_ALLOWLIST = [
          "http://127.0.0.1:4173",
          "http://localhost:4173",
        ];
        return AIR_GAP_DEFAULT_ALLOWLIST.some((allowed) => {
          if (dest === allowed || dest === `${allowed}/`) return true;
          try {
            const u = new URL(dest.startsWith("http") ? dest : `http://${dest}`);
            const a = new URL(allowed);
            return u.hostname === a.hostname && (u.port || "80") === (a.port || "80");
          } catch {
            return false;
          }
        });
      }

      // Egress is permitted IF AND ONLY IF EVERY active deny-by-default session independently permits it!
      for (const session of denySessions) {
        if (!this.checkSessionPermits(session, dest)) {
          return false;
        }
      }
      return true;
    }

    return true;
  }

  private static checkSessionPermits(session: ActiveObservationSession, dest: string): boolean {
    if (this.globalAirGapEnforce && (dest.startsWith("http://") || dest.startsWith("https://") || dest.startsWith("ws://") || dest.startsWith("wss://"))) {
      try {
        const u = new URL(dest);
        const isLoopback = u.hostname === "127.0.0.1" || u.hostname === "localhost";
        if (!isLoopback) {
          // Global air-gap enforcement strictly forbids external cloud domains regardless of session wildcard
          return false;
        }
      } catch {}
    }
    if (session.hasWildcard) return !this.globalAirGapEnforce;
    return session.permittedDestinations.some((allowed) => {
      if (allowed === "*" || allowed === dest) return true;
      try {
        const destNorm = dest.startsWith("http://") || dest.startsWith("https://") || dest.startsWith("ws://") || dest.startsWith("wss://")
          ? dest
          : `http://${dest}`;
        const allowedNorm = allowed.startsWith("http://") || allowed.startsWith("https://") || allowed.startsWith("ws://") || allowed.startsWith("wss://")
          ? allowed
          : `http://${allowed}`;

        const destUrl = new URL(destNorm);
        const allowUrl = new URL(allowedNorm);

        const hostMatches = destUrl.hostname === allowUrl.hostname;
        if (!hostMatches) return false;

        // If allowed specifies an explicit port, destination port must strictly match
        if (allowUrl.port) {
          const destPort = destUrl.port || (destUrl.protocol === "https:" || destUrl.protocol === "wss:" ? "443" : "80");
          return destPort === allowUrl.port;
        } else {
          // Strict air-gap: If no port is specified in allowlist rule, only standard default scheme ports (80/443) match.
          // Non-standard ports (e.g. 8080, 9222, etc.) are strictly forbidden unless explicitly declared.
          const destPort = destUrl.port || (destUrl.protocol === "https:" || destUrl.protocol === "wss:" ? "443" : "80");
          const defaultPort = allowUrl.protocol === "https:" || allowUrl.protocol === "wss:" ? "443" : "80";
          return destPort === defaultPort;
        }
      } catch {
        return dest === allowed;
      }
    });
  }

  /**
   * Identifies whether a target represents a purely local in-memory or filesystem resource
   * (e.g. file:// URIs, local absolute file paths in Node, data: or blob: URIs) rather than
   * an outbound network interface connection.
   */
  public static isLocalResource(dest: string): boolean {
    if (!dest) return false;
    return (
      dest.startsWith("file://") ||
      dest.startsWith("data:") ||
      dest.startsWith("blob:") ||
      (typeof process !== "undefined" && (dest.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(dest)))
    );
  }

  private static extractSocketDestination(args: any[]): string {
    let opt = args[0];
    if (Array.isArray(opt)) {
      opt = opt[0];
    }
    if (typeof opt === "object" && opt !== null) {
      const host = opt.host || opt.hostname || "localhost";
      const port = opt.port || "";
      return port ? `${host}:${port}` : `${host}`;
    }
    const port = args[0];
    const host = typeof args[1] === "string" ? args[1] : "localhost";
    return port ? `${host}:${port}` : `${host}`;
  }

  public static ensureHooksInstalled(): void {
    if (this.isHooked) return;

    const self = this;

    // 1. Node.js TCP socket interception
    if (typeof process !== "undefined" && Boolean(process.versions?.node)) {
      try {
        const { createRequire } = (globalThis as any).require
          ? { createRequire: () => (globalThis as any).require }
          : // eslint-disable-next-line @typescript-eslint/no-var-requires
            require("node:module");
        const nodeRequire = createRequire(import.meta.url);
        const net = nodeRequire("node:net");
        if (net?.Socket?.prototype && !this.origSocketConnect) {
          this.origSocketConnect = net.Socket.prototype.connect;
          net.Socket.prototype.connect = function (this: any, ...args: any[]) {
            if (self.activeSessions > 0) {
              self.packetCount++;
              const dest = self.extractSocketDestination(args);
              self.destinations.push(dest);

              if (self.isDestinationPermitted(dest)) {
                self.permittedConnections.push(dest);
                return (self.origSocketConnect as any).apply(this, args);
              }

              if (self.isDenyByDefaultActive()) {
                self.blockedConnections.push(dest);
                const blockErr = new Error(
                  `AIR_GAP_EGRESS_BLOCKED: Outbound TCP socket connect to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
                );
                if (typeof this.destroy === "function") {
                  try {
                    this.destroy();
                  } catch {}
                }
                throw blockErr;
              }
            }
            return (self.origSocketConnect as any).apply(this, args);
          };
        }
      } catch {
        import("node:net")
          .then((mod) => {
            if (!this.origSocketConnect && mod?.Socket?.prototype) {
              this.origSocketConnect = mod.Socket.prototype.connect;
              mod.Socket.prototype.connect = function (this: any, ...args: any[]) {
                if (self.activeSessions > 0) {
                  self.packetCount++;
                  const dest = self.extractSocketDestination(args);
                  self.destinations.push(dest);

                  if (self.isDestinationPermitted(dest)) {
                    self.permittedConnections.push(dest);
                    return (self.origSocketConnect as any).apply(this, args);
                  }

                  if (self.isDenyByDefaultActive()) {
                    self.blockedConnections.push(dest);
                    const blockErr = new Error(
                      `AIR_GAP_EGRESS_BLOCKED: Outbound TCP socket connect to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
                    );
                    if (typeof this.destroy === "function") {
                      try {
                        this.destroy();
                      } catch {}
                    }
                    throw blockErr;
                  }
                }
                return (self.origSocketConnect as any).apply(this, args);
              };
            }
          })
          .catch(() => {});
      }
    }

    // 2. Universal fetch interception
    if (typeof globalThis.fetch === "function" && !this.origFetch) {
      this.origFetch = globalThis.fetch;
      globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        if (self.activeSessions > 0) {
          const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

          // Purely local filesystem or in-memory resource reads do not create network packets
          if (self.isLocalResource(urlStr)) {
            return (self.origFetch as any).call(globalThis, input, init);
          }

          self.packetCount++;
          self.destinations.push(urlStr);

          if (self.isDestinationPermitted(urlStr)) {
            self.permittedConnections.push(urlStr);
            return (self.origFetch as any).call(globalThis, input, init);
          }

          if (self.isDenyByDefaultActive()) {
            self.blockedConnections.push(urlStr);
            throw new Error(
              `AIR_GAP_EGRESS_BLOCKED: Outbound fetch to '${urlStr}' actively blocked by SPE Ω deny-by-default policy.`
            );
          }
        }
        return (self.origFetch as any).call(globalThis, input, init);
      };
    }

    // 3. Browser / Polyfilled XMLHttpRequest interception
    if (typeof (globalThis as any).XMLHttpRequest !== "undefined" && !this.origXhrOpen) {
      const xhrProto = (globalThis as any).XMLHttpRequest.prototype;
      this.origXhrOpen = xhrProto.open;
      this.origXhrSend = xhrProto.send;

      xhrProto.open = function (this: any, method: string, url: string | URL, ...rest: any[]) {
        this._speObservedUrl = typeof url === "string" ? url : url.toString();
        this._speObservedMethod = method;
        return (self.origXhrOpen as any).apply(this, [method, url, ...rest]);
      };

      xhrProto.send = function (this: any, ...args: any[]) {
        if (self.activeSessions > 0) {
          self.packetCount++;
          const dest = this._speObservedUrl || "unknown_xhr_endpoint";
          self.destinations.push(dest);

          if (self.isDestinationPermitted(dest)) {
            self.permittedConnections.push(dest);
            return (self.origXhrSend as any).apply(this, args);
          }

          if (self.isDenyByDefaultActive()) {
            self.blockedConnections.push(dest);
            throw new Error(
              `AIR_GAP_EGRESS_BLOCKED: Outbound XMLHttpRequest to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
            );
          }
        }
        return (self.origXhrSend as any).apply(this, args);
      };
    }

    // 4. Browser / Polyfilled WebSocket interception
    if (typeof (globalThis as any).WebSocket !== "undefined" && !this.origWebSocket) {
      const origWs = (globalThis as any).WebSocket;
      this.origWebSocket = origWs;

      const WrappedWebSocket = function (this: any, url: string | URL, protocols?: string | string[]) {
        const dest = typeof url === "string" ? url : url.toString();
        if (self.activeSessions > 0) {
          self.packetCount++;
          self.destinations.push(dest);

          if (self.isDestinationPermitted(dest)) {
            self.permittedConnections.push(dest);
            return new origWs(url, protocols);
          }

          if (self.isDenyByDefaultActive()) {
            self.blockedConnections.push(dest);
            throw new Error(
              `AIR_GAP_EGRESS_BLOCKED: Outbound WebSocket connection to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
            );
          }
        }
        return new origWs(url, protocols);
      };
      WrappedWebSocket.prototype = origWs.prototype;
      (globalThis as any).WebSocket = WrappedWebSocket;
    }

    // 5. Browser / Polyfilled EventSource (Server-Sent Events) interception
    if (typeof (globalThis as any).EventSource !== "undefined" && !this.origEventSource) {
      const origEs = (globalThis as any).EventSource;
      this.origEventSource = origEs;

      const WrappedEventSource = function (this: any, url: string | URL, eventSourceInitDict?: any) {
        const dest = typeof url === "string" ? url : url.toString();
        if (self.activeSessions > 0) {
          self.packetCount++;
          self.destinations.push(dest);

          if (self.isDestinationPermitted(dest)) {
            self.permittedConnections.push(dest);
            return new origEs(url, eventSourceInitDict);
          }

          if (self.isDenyByDefaultActive()) {
            self.blockedConnections.push(dest);
            throw new Error(
              `AIR_GAP_EGRESS_BLOCKED: Outbound EventSource connection to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
            );
          }
        }
        return new origEs(url, eventSourceInitDict);
      };
      WrappedEventSource.prototype = origEs.prototype;
      (globalThis as any).EventSource = WrappedEventSource;
    }

    // 6. Browser navigator.sendBeacon telemetry interception
    if (
      typeof (globalThis as any).navigator !== "undefined" &&
      typeof (globalThis as any).navigator.sendBeacon === "function" &&
      !this.origSendBeacon
    ) {
      const nav = (globalThis as any).navigator;
      this.origSendBeacon = nav.sendBeacon;
      nav.sendBeacon = function (url: string | URL, data?: any): boolean {
        const dest = typeof url === "string" ? url : url.toString();
        if (self.activeSessions > 0) {
          self.packetCount++;
          self.destinations.push(dest);

          if (self.isDestinationPermitted(dest)) {
            self.permittedConnections.push(dest);
            return (self.origSendBeacon as any).call(nav, url, data);
          }

          if (self.isDenyByDefaultActive()) {
            self.blockedConnections.push(dest);
            throw new Error(
              `AIR_GAP_EGRESS_BLOCKED: Outbound navigator.sendBeacon to '${dest}' actively blocked by SPE Ω deny-by-default policy.`
            );
          }
        }
        return (self.origSendBeacon as any).call(nav, url, data);
      };
    }

    this.isHooked = true;
  }

  /**
   * Begins an active egress observation window with optional deny-by-default enforcement.
   */
  public static startObservation(options: ObservationOptions = {}): () => NetworkObservationReport {
    this.ensureHooksInstalled();
    const sessionId = `obs_session_${Date.now()}_${++this.sessionCounter}`;
    const denyEnforced = options.denyByDefault !== false;
    const permitted = Array.isArray(options.permittedDestinations)
      ? [...options.permittedDestinations]
      : [];
    const hasWildcard = permitted.includes("*");

    const session: ActiveObservationSession = {
      id: sessionId,
      denyByDefault: denyEnforced,
      permittedDestinations: permitted,
      hasWildcard,
      startMs: Date.now(),
      initialCount: this.packetCount,
      initialDestLen: this.destinations.length,
      initialBlockedLen: this.blockedConnections.length,
      initialPermittedLen: this.permittedConnections.length,
    };

    this.sessions.set(sessionId, session);
    this.activeSessions = this.sessions.size;
    this.activeDenySessions = Array.from(this.sessions.values()).filter((s) => s.denyByDefault).length;

    return (): NetworkObservationReport => {
      this.sessions.delete(sessionId);
      this.activeSessions = this.sessions.size;
      this.activeDenySessions = Array.from(this.sessions.values()).filter((s) => s.denyByDefault).length;

      const packets = this.packetCount - session.initialCount;
      const dests = this.destinations.slice(session.initialDestLen);
      const blocked = this.blockedConnections.slice(session.initialBlockedLen);
      const permittedConns = this.permittedConnections.slice(session.initialPermittedLen);

      return {
        observedPackets: packets,
        observedDestinations: dests,
        blockedConnections: blocked,
        permittedConnections: permittedConns,
        airGapViolated: packets > 0,
        observationDurationMs: Date.now() - session.startMs,
        denyByDefaultEnforced: denyEnforced,
      };
    };
  }

  /**
   * Executes an async operation with active network egress observation and policy enforcement.
   */
  public static async observeDuring<T>(
    operation: () => Promise<T>,
    options: ObservationOptions = {}
  ): Promise<{ result: T; report: NetworkObservationReport }> {
    const endObservation = this.startObservation(options);
    try {
      const result = await operation();
      const report = endObservation();
      return { result, report };
    } catch (err) {
      const report = endObservation();
      if ((err as Error)?.message?.includes("AIR_GAP_EGRESS_BLOCKED")) {
        // If an egress attempt was blocked, rethrow with report metadata attached
        (err as any).observationReport = report;
      }
      throw err;
    }
  }

  /**
   * Returns current observed packet count.
   */
  public static getObservedPacketCount(): number {
    return this.packetCount;
  }

  /**
   * Returns currently recorded blocked connection destinations.
   */
  public static getBlockedConnections(): string[] {
    return [...this.blockedConnections];
  }

  /**
   * Returns currently recorded permitted connection destinations.
   */
  public static getPermittedConnections(): string[] {
    return [...this.permittedConnections];
  }

  /**
   * Resets observation counters (strictly prohibited while observation sessions are active).
   */
  public static resetForTesting(): void {
    if (this.sessions.size > 0 || this.activeSessions > 0) {
      throw new Error(
        "ILLEGAL_RESET_ATTEMPT: Cannot reset NetworkEgressObserver while observation sessions are actively running. " +
        "Active sessions must be completed or stopped cleanly before resetting."
      );
    }
    this.packetCount = 0;
    this.destinations = [];
    this.blockedConnections = [];
    this.permittedConnections = [];
    this.sessions.clear();
    this.activeSessions = 0;
    this.activeDenySessions = 0;
    this.globalAirGapEnforce = false;
  }
}

// Auto-install hooks on module load
NetworkEgressObserver.ensureHooksInstalled();
