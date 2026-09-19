import { Logo } from "../brand/Logo";

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
    <header className={`spe-nav ${scrolled ? "is-scrolled" : ""}`}>
      <a
        className="spe-nav-brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <Logo size="md" />
      </a>

      <button
        type="button"
        className="spe-nav-burger"
        aria-expanded={menuOpen}
        aria-controls="spe-primary-nav"
        aria-label="Menu"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span />
        <span />
      </button>

      <nav id="spe-primary-nav" className={`spe-nav-links ${menuOpen ? "open" : ""}`} aria-label="Primary">
        <button type="button" aria-current={view === "home" ? "page" : undefined} onClick={() => { onNavigate("home"); setMenuOpen(false); }}>
          Create
        </button>
        <a href="#problem" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>Explore</a>
        <a href="#daily" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>Daily</a>
        <a href="#artifact-story" onClick={() => { onNavigate("home"); setMenuOpen(false); }}>.spe</a>
        <button type="button" className="spe-nav-cta" onClick={() => { onOpenSpe(); setMenuOpen(false); }}>
          Open SPE
        </button>
      </nav>
    </header>
  );
}
