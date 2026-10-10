import { useState, useEffect, useRef } from "react";
import { pathForView, type AppView } from "../routing";
import { ThemeToggle } from "../ui/ThemeToggle";

type Props = {
  scrolled: boolean;
  view: AppView | null;
  onNavigate: (v: AppView) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  savedCount?: number;
  onSubmitWorkflow?: () => void;
};

interface NavItem {
  id: AppView;
  label: string;
  desc: string;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "products",
    label: "Products",
    items: [
      {
        id: "create",
        label: "Prompt Studio",
        desc: "Build & compile bulletproof prompts for any AI",
      },
      {
        id: "code",
        label: "S-Code",
        desc: "Convert UI screenshots into clean React/HTML",
      },
      {
        id: "workflows",
        label: "Verified Workflows",
        desc: "Pre-tested multi-step agent recipes for GitHub & code",
      },
      {
        id: "skill-builder",
        label: "Skill Builder",
        desc: "Create & security-scan custom agent skills",
      },
    ],
  },
  {
    id: "tools",
    label: "Testing & Tools",
    items: [
      {
        id: "compare",
        label: "Benchmark Arena",
        desc: "Head-to-head prompt tests with real accuracy proof",
      },
      {
        id: "lab",
        label: "Daily Recipes",
        desc: "Daily tested prompts & inspiration",
      },
      {
        id: "website",
        label: "3D Canvas",
        desc: "Interactive 3D workspace & canvas builder",
      },
      {
        id: "research",
        label: "Private Search",
        desc: "Private local grounding with zero cloud leaks",
      },
    ],
  },
  {
    id: "why",
    label: "Why SPE",
    items: [
      {
        id: "capabilities",
        label: "Scope Guardrails",
        desc: "Strict project boundaries that keep agents in line",
      },
      {
        id: "privacy",
        label: "100% On-Device Privacy",
        desc: "Zero prompt bytes ever leave your machine",
      },
      {
        id: "compare",
        label: "Token & Cost Proof",
        desc: "See how SPE saves 8 hours and $35/week",
      },
    ],
  },
];

export type { AppView };

export function Nav(p: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleLinkClick = (id: AppView) => {
    p.onNavigate(id);
    p.setMenuOpen(false);
    setOpenDropdown(null);
  };

  const toggleDropdown = (groupId: string) => {
    setOpenDropdown((prev) => (prev === groupId ? null : groupId));
  };

  return (
    <header
      ref={navRef}
      className={`spe-nav ${p.scrolled ? "is-scrolled" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (p.menuOpen) {
            p.setMenuOpen(false);
          }
          setOpenDropdown(null);
        }
      }}
    >
      <a
        className="spe-nav-brand"
        href={pathForView("home")}
        onClick={(e) => {
          e.preventDefault();
          handleLinkClick("home");
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

      <ThemeToggle />

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
        {/* Dropdown Groups */}
        {NAV_GROUPS.map((group) => {
          const isOpen = openDropdown === group.id;
          const isGroupActive = group.items.some((item) => p.view === item.id);

          return (
            <div
              key={group.id}
              className={`spe-nav-dropdown-wrapper ${isOpen ? "is-open" : ""}`}
              onMouseEnter={() => {
                if (window.innerWidth > 1024) setOpenDropdown(group.id);
              }}
              onMouseLeave={() => {
                if (window.innerWidth > 1024) setOpenDropdown(null);
              }}
            >
              <button
                type="button"
                className={`spe-nav-dropdown-trigger ${isGroupActive ? "is-active" : ""}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => toggleDropdown(group.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                    e.preventDefault();
                    toggleDropdown(group.id);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setOpenDropdown(null);
                  }
                }}
              >
                <span>{group.label}</span>
                <span className="spe-dropdown-caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              <div
                className={`spe-nav-dropdown-menu ${isOpen ? "is-visible" : ""}`}
                role="menu"
                aria-label={group.label}
              >
                {group.items.map((item) => (
                  <a
                    key={`${group.id}-${item.id}-${item.label}`}
                    href={pathForView(item.id)}
                    role="menuitem"
                    className={`spe-nav-dropdown-item ${p.view === item.id ? "is-active" : ""}`}
                    aria-current={p.view === item.id ? "page" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      handleLinkClick(item.id);
                    }}
                  >
                    <span className="spe-dropdown-item-title">{item.label}</span>
                    <span className="spe-dropdown-item-desc">{item.desc}</span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}

        {/* Direct Link: Plans & Pricing */}
        <a
          href={pathForView("pricing")}
          className={`spe-nav-direct-link ${p.view === "pricing" ? "is-active" : ""}`}
          aria-current={p.view === "pricing" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("pricing");
          }}
        >
          Pricing
        </a>

        {/* Direct Link: Saved Prompts */}
        <a
          href={pathForView("my-work")}
          className={`spe-nav-direct-link ${p.view === "my-work" ? "is-active" : ""}`}
          aria-current={p.view === "my-work" ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("my-work");
          }}
        >
          <span>Saved</span>
          {typeof p.savedCount === "number" && p.savedCount > 0 && (
            <span className="spe-nav-badge">{p.savedCount}</span>
          )}
        </a>

        {/* Direct Link: Submit Workflow (GitHub PR) */}
        <button
          type="button"
          className="spe-nav-direct-link spe-nav-submit-pr"
          onClick={() => {
            if (p.onSubmitWorkflow) {
              p.onSubmitWorkflow();
            } else {
              handleLinkClick("workflows");
            }
            p.setMenuOpen(false);
          }}
          aria-label="Submit a Workflow via GitHub PR"
        >
          <span>Submit Workflow ↗</span>
        </button>

        {/* Primary Action Pill */}
        <a
          className="spe-nav-cta"
          href={pathForView("create")}
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("create");
          }}
        >
          Open Prompt Studio Free <span>↗</span>
        </a>
      </nav>
    </header>
  );
}
