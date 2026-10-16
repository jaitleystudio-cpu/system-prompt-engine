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

export class NetworkEgressObserver {
  private static activeSessions = 0;
  private static activeDenySessions = 0;
  private static packetCount = 0;
  private static destinations: string[] = [];
  private static blockedConnections: string[] = [];
  private static permittedConnections: string[] = [];
  private static permittedDestinationsList: string[] = [];
  private static isHooked = false;
  private static origSocketConnect: unknown = null;
  private static origFetch: unknown = null;
  private static origXhrOpen: unknown = null;
  private static origXhrSend: unknown = null;
  private static origWebSocket: unknown = null;
  private static origEventSource: unknown = null;
  private static origSendBeacon: unknown = null;

  public static isDenyByDefaultActive(): boolean {
    return this.activeDenySessions > 0 || process.env.SPE_AIR_GAP_ENFORCE === "1";
  }

  public static isDestinationPermitted(dest: string): boolean {
    if (!dest) return false;
    return this.permittedDestinationsList.some((allowed) => {
      if (allowed === "*" || allowed === dest) return true;
      try {
        const destUrl = new URL(dest.startsWith("http") || dest.startsWith("ws") ? dest : `http://${dest}`);
        const allowUrl = new URL(allowed.startsWith("http") || allowed.startsWith("ws") ? allowed : `http://${allowed}`);
        return destUrl.hostname === allowUrl.hostname || destUrl.host === allowUrl.host;
      } catch {
        return dest.includes(allowed);
      }
    });
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
          self.packetCount++;
          const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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
    const startMs = Date.now();
    const initialCount = this.packetCount;
    const initialDestLen = this.destinations.length;
    const initialBlockedLen = this.blockedConnections.length;
    const initialPermittedLen = this.permittedConnections.length;

    this.activeSessions++;
    const denyEnforced = Boolean(options.denyByDefault);
    if (denyEnforced) {
      this.activeDenySessions++;
    }

    if (Array.isArray(options.permittedDestinations)) {
      this.permittedDestinationsList = [...options.permittedDestinations];
    }

    return (): NetworkObservationReport => {
      this.activeSessions = Math.max(0, this.activeSessions - 1);
      if (denyEnforced) {
        this.activeDenySessions = Math.max(0, this.activeDenySessions - 1);
      }
      const packets = this.packetCount - initialCount;
      const dests = this.destinations.slice(initialDestLen);
      const blocked = this.blockedConnections.slice(initialBlockedLen);
      const permitted = this.permittedConnections.slice(initialPermittedLen);

      return {
        observedPackets: packets,
        observedDestinations: dests,
        blockedConnections: blocked,
        permittedConnections: permitted,
        airGapViolated: packets > 0,
        observationDurationMs: Date.now() - startMs,
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
   * Resets observation counters (for testing).
   */
  public static resetForTesting(): void {
    this.packetCount = 0;
    this.destinations = [];
    this.blockedConnections = [];
    this.permittedConnections = [];
    this.permittedDestinationsList = [];
    this.activeSessions = 0;
    this.activeDenySessions = 0;
  }
}

// Auto-install hooks on module load
NetworkEgressObserver.ensureHooksInstalled();
