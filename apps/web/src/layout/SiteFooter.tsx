import { FOOTER_NAV_LABEL, footerLinks } from "../search/foundation.mjs";
import type { RoutableView } from "../routing";

export function SiteFooter({
  onNavigate,
}: {
  onNavigate: (view: RoutableView) => void;
}) {
  return (
    <nav className="spe-footer-links" aria-label={FOOTER_NAV_LABEL}>
      {footerLinks().map((link) => (
        <a
          key={link.id}
          href={link.path}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(link.id as RoutableView);
          }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
