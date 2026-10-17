import type { AppView } from "../routing";
import { InAppLink } from "./inAppLink";

export function NotFound({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <section className="spe-not-found" aria-labelledby="not-found-title">
      <p className="spe-kicker">Not found</p>
      <h1 id="not-found-title">Page not found</h1>
      <p>
        Nothing in this preview lives at <code>{path}</code>. Your idea on this
        page was not cleared.
      </p>
      <p>
        <InAppLink view="home" onNavigate={onNavigate}>
          Back to Home
        </InAppLink>
      </p>
    </section>
  );
}
