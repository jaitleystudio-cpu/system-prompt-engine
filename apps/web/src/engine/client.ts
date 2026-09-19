import type { CompilePhase, EngineError, EngineSuccessBody, WorkerRequest, WorkerResponse } from "./types";

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
      const timer = setTimeout(() => {
        this.worker.removeEventListener("message", onMsg);
        reject(new Error("WORKER_TIMEOUT"));
      }, 20_000);
      const onMsg = (ev: MessageEvent<WorkerResponse>) => {
        if (ev.data.id !== id) return;
        if (ev.data.type === "status") {
          onPhase(ev.data.phase);
          return;
        }
        clearTimeout(timer);
        this.worker.removeEventListener("message", onMsg);
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
      const req: WorkerRequest = { id, type: "evaluate", jsonText };
      this.worker.postMessage(req);
    });
  }
}
