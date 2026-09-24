export type AppView =
  | "home"
  | "create"
  | "code"
  | "lab"
  | "my-work"
  | "privacy"
  | "workspace";

type Props = {
  scrolled: boolean;
  view: AppView;
  onNavigate: (v: AppView) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
};

const LINKS: { id: AppView; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "create", label: "Create" },
  { id: "code", label: "Code" },
  { id: "lab", label: "Daily Lab" },
  { id: "my-work", label: "My Work" },
  { id: "privacy", label: "Privacy / Proof" },
];

export function Nav(p: Props) {
  return (
    <header className={`spe-nav ${p.scrolled ? "is-scrolled" : ""}`}>
      <a
        className="spe-nav-brand"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
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
        {LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            className={p.view === link.id ? "is-active" : ""}
            aria-current={p.view === link.id ? "page" : undefined}
            onClick={() => {
              p.onNavigate(link.id);
              p.setMenuOpen(false);
            }}
          >
            {link.label}
          </button>
        ))}
        <button
          className="spe-nav-cta"
          type="button"
          onClick={() => {
            p.onNavigate("create");
            p.setMenuOpen(false);
          }}
        >
          Build my prompt <span>↗</span>
        </button>
      </nav>
    </header>
  );
}
