import type {
  CompilePhase,
  EngineError,
  EngineSuccessBody,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export type CompileOutcome = {
  error: EngineError | null;
  result: EngineSuccessBody | null;
  phases: string[];
  sha256: string | null;
  imports: number | null;
  used_ts_fallback: false;
};

export class EngineClient {
  private worker: Worker;
  private seq = 0;

  constructor() {
    this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  terminate(): void {
    this.worker.terminate();
  }

  compile(
    jsonText: string,
    onPhase: (phase: CompilePhase) => void,
  ): Promise<CompileOutcome> {
    const id = `req-${++this.seq}`;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.worker.removeEventListener("message", onMsg);
        this.worker.removeEventListener("error", onError);
        this.worker.removeEventListener("messageerror", onMessageError);
      };
      const onError = (ev: ErrorEvent) => {
        cleanup();
        reject(new Error(ev.message || "The local worker could not start."));
      };
      const onMessageError = () => {
        cleanup();
        reject(new Error("The local worker returned an unreadable response."));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("WORKER_TIMEOUT"));
      }, 20_000);
      const onMsg = (ev: MessageEvent<WorkerResponse>) => {
        if (ev.data.id !== id) return;
        if (ev.data.type === "status") {
          onPhase(ev.data.phase);
          return;
        }
        cleanup();
        resolve({
          error: ev.data.error,
          result: ev.data.result,
          phases: ev.data.phases,
          sha256: ev.data.sha256,
          imports: ev.data.imports,
          used_ts_fallback: false,
        });
      };
      this.worker.addEventListener("message", onMsg);
      this.worker.addEventListener("error", onError);
      this.worker.addEventListener("messageerror", onMessageError);
      const req: WorkerRequest = { id, type: "evaluate", jsonText };
      try {
        this.worker.postMessage(req);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }
}
