/**
 * SPE Language Server Protocol (LSP) Client Bridge
 *
 * Implements JSON-RPC 2.0 stdio transport communicating with `spe_runtime.developer.lsp_server`.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface LspMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class SpeLspClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer: string = '';
  private nextId = 1;
  private pendingRequests: Map<number, { resolve: (res: any) => void; reject: (err: any) => void }> = new Map();

  private pythonPath: string;

  constructor(pythonPath: string = 'python3') {
    super();
    this.pythonPath = pythonPath;
  }

  public start(repoRoot?: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.process = spawn(this.pythonPath, ['-m', 'spe_runtime.developer.lsp_server'], {
          cwd: repoRoot,
          env: {
            ...process.env,
            PYTHONPATH: repoRoot || process.cwd(),
          },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.stdout?.on('data', (chunk: Buffer) => {
          this.handleData(chunk.toString('utf8'));
        });

        this.process.stderr?.on('data', (chunk: Buffer) => {
          this.emit('log', chunk.toString('utf8'));
        });

        this.process.on('error', (err) => {
          this.emit('error', err);
          resolve(false);
        });

        this.process.on('exit', (code) => {
          this.emit('exit', code);
          this.process = null;
        });

        // Initialize handshake
        this.sendRequest('initialize', {
          processId: process.pid,
          rootUri: null,
          capabilities: {},
        })
          .then(() => resolve(true))
          .catch(() => resolve(false));
      } catch (err) {
        this.emit('error', err);
        resolve(false);
      }
    });
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  public sendNotification(method: string, params: any): void {
    const payload: LspMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.writeFrame(payload);
  }

  public sendRequest(method: string, params: any): Promise<any> {
    const id = this.nextId++;
    const payload: LspMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.writeFrame(payload);
    });
  }

  public static encodeFrame(payload: LspMessage): string {
    const json = JSON.stringify(payload);
    const byteLength = Buffer.byteLength(json, 'utf8');
    return `Content-Length: ${byteLength}\r\n\r\n${json}`;
  }

  public static parseFrames(buffer: string): { frames: LspMessage[]; remaining: string } {
    const frames: LspMessage[] = [];
    let current = buffer;

    while (true) {
      const headerMatch = current.match(/Content-Length:\s*(\d+)\r\n\r\n/);
      if (!headerMatch || headerMatch.index === undefined) break;

      const headerEnd = headerMatch.index + headerMatch[0].length;
      const contentLength = parseInt(headerMatch[1], 10);
      const totalLength = headerEnd + contentLength;

      if (Buffer.byteLength(current, 'utf8') < totalLength) {
        break; // Frame incomplete
      }

      const body = current.slice(headerEnd, headerEnd + contentLength);
      try {
        frames.push(JSON.parse(body));
      } catch {
        // Skip malformed frame
      }
      current = current.slice(headerEnd + contentLength);
    }

    return { frames, remaining: current };
  }

  private writeFrame(payload: LspMessage): void {
    if (!this.process?.stdin?.writable) return;
    const frame = SpeLspClient.encodeFrame(payload);
    this.process.stdin.write(frame);
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    const { frames, remaining } = SpeLspClient.parseFrames(this.buffer);
    this.buffer = remaining;

    for (const msg of frames) {
      if (typeof msg.id === 'number' && this.pendingRequests.has(msg.id)) {
        const { resolve, reject } = this.pendingRequests.get(msg.id)!;
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(msg.error);
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        this.emit('notification', msg);
      }
    }
  }
}
