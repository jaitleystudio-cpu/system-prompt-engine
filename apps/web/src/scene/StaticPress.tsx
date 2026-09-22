/** Original art fallback. It is illustrative, never an engine-result visualization. */
export function StaticPress({ output: _output }: { output?: unknown }) {
  return (
    <div className="static-core" aria-hidden="true">
      <img
        src="/art/intent-core.webp"
        width="960"
        height="640"
        alt=""
        decoding="async" fetchPriority="high"
      />
    </div>
  );
}
