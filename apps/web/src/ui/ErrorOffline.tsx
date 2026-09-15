import type { EngineError } from "../engine/types";

type Props = {
  online: boolean;
  error: EngineError | null;
};

export function ErrorOffline({ online, error }: Props) {
  if (online && !error) return null;
  return (
    <section className="panel" aria-labelledby="err-heading" role="region">
      <h2 id="err-heading">Error / Offline</h2>
      {!online ? (
        <p className="pill warn" role="status">
          Browser reports offline. App shell + WASM may still serve from the service worker cache.
          Private prompts are never cached.
        </p>
      ) : null}
      {error ? (
        <p className="pill danger" role="alert">
          {error.code}
        </p>
      ) : null}
    </section>
  );
}
