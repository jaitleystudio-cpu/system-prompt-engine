import { LogoLockup } from "../brand/Logo";

type Props = {
  scrolled: boolean;
  view: "home" | "workspace";
  onNavigate: (v: "home" | "workspace") => void;
  onOpenSpe: () => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
};

export function Nav({ scrolled, view, onNavigate, onOpenSpe, menuOpen, setMenuOpen }: Props) {
  return (
    <header className={`forge-nav ${scrolled ? "is-scrolled" : ""}`}>
      <a
        className="forge-nav-brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <LogoLockup size={40} />
      </a>

      <button
        type="button"
        className="forge-nav-burger"
        aria-expanded={menuOpen}
        aria-controls="forge-primary-nav"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <nav
        id="forge-primary-nav"
        className={`forge-nav-links ${menuOpen ? "open" : ""}`}
        aria-label="Primary"
      >
        <button
          type="button"
          aria-current={view === "home" ? "page" : undefined}
          onClick={() => {
            onNavigate("home");
            setMenuOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Forge
        </button>
        <a href="#act-extract" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>
          Process
        </a>
        <a href="#act-portable" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>
          .spe
        </a>
        <a href="#act-daily" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>
          Daily Lab
        </a>
        <button
          type="button"
          className="forge-nav-cta"
          onClick={() => {
            onOpenSpe();
            setMenuOpen(false);
          }}
        >
          Open workbench
        </button>
      </nav>
    </header>
  );
}
