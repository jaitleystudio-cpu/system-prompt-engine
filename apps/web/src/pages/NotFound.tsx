import { FOOTER_NAV_LABEL, NOT_FOUND, footerLinks } from "../search/foundation.mjs";
import type { RoutableView } from "../routing";

export function NotFound({
  onNavigate,
}: {
  onNavigate: (view: RoutableView) => void;
}) {
  return (
    <section className="spe-not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">{NOT_FOUND.h1}</h1>
      {NOT_FOUND.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <nav aria-label={FOOTER_NAV_LABEL}>
        <ul className="spe-seo-links">
          {footerLinks().map((link) => (
            <li key={link.id}>
              <a
                href={link.path}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(link.id as RoutableView);
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
