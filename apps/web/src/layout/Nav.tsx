type Props = {
  scrolled: boolean;
  view: "home" | "workspace";
  onNavigate: (v: "home" | "workspace") => void;
  onOpenSpe: () => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
};
export function Nav(p: Props) {
  return (
    <header className={`spe-nav ${p.scrolled ? "is-scrolled" : ""}`}>
      <a
        className="spe-nav-brand"
        href="#top"
        onClick={() => {
          p.onNavigate("home");
          p.setMenuOpen(false);
        }}
        aria-label="SPE — System Prompt Engine home"
      >
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>SPE</span>
      </a>
      <span className="nav-description">
        SYSTEM
        <br />
        PROMPT ENGINE
      </span>
      <button
        className="spe-nav-burger"
        aria-label="Menu"
        aria-expanded={p.menuOpen}
        aria-controls="spe-primary-nav"
        onClick={() => p.setMenuOpen(!p.menuOpen)}
      >
        ☰
      </button>
      <nav
        id="spe-primary-nav"
        className={`spe-nav-links ${p.menuOpen ? "open" : ""}`}
        aria-label="Primary"
      >
        <a
          href="#how-it-works"
          onClick={() => {
            p.onNavigate("home");
            p.setMenuOpen(false);
          }}
        >
          The process
        </a>
        <a
          href="#artifact-story"
          onClick={() => {
            p.onNavigate("home");
            p.setMenuOpen(false);
          }}
        >
          The artifact
        </a>
        <a
          href="#privacy"
          onClick={() => {
            p.onNavigate("home");
            p.setMenuOpen(false);
          }}
        >
          Your privacy
        </a>
        <button
          className="spe-nav-cta"
          onClick={() => {
            p.onOpenSpe();
            p.setMenuOpen(false);
          }}
        >
          Open workspace <span>↗</span>
        </button>
      </nav>
    </header>
  );
}
