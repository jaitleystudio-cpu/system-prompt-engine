import { useEffect, useState } from "react";
import {
  applyTheme,
  cycleTheme,
  readThemePreference,
  themeLabel,
  type ThemePreference,
} from "./theme";

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const initial = readThemePreference();
    setPref(initial);
    setResolved(applyTheme(initial));
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onScheme = () => {
      const current = readThemePreference();
      if (current === "system") setResolved(applyTheme("system"));
    };
    mq.addEventListener("change", onScheme);
    return () => mq.removeEventListener("change", onScheme);
  }, []);

  const onCycle = () => {
    const next = cycleTheme(pref);
    setPref(next);
    setResolved(applyTheme(next));
  };

  return (
    <button
      type="button"
      className="spe-theme-toggle"
      onClick={onCycle}
      aria-label={`Theme: ${themeLabel(pref)} (resolved ${resolved}). Activate to switch.`}
      aria-pressed={resolved === "dark"}
      title={`Theme: ${themeLabel(pref)}`}
      data-theme-pref={pref}
      data-theme-resolved={resolved}
    >
      <span className="spe-theme-toggle-icon" aria-hidden="true">
        {resolved === "dark" ? "◐" : "◯"}
      </span>
      <span className="spe-theme-toggle-text">{themeLabel(pref)}</span>
    </button>
  );
}

export function bootstrapTheme(): void {
  if (typeof document === "undefined") return;
  applyTheme(readThemePreference());
}
