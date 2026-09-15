import { PrivacyIndicator } from "./PrivacyIndicator";

type Props = {
  sensitivity: string | null;
  trust: string | null;
  authority: string | null;
  online: boolean;
};

export function Header({ sensitivity, trust, authority, online }: Props) {
  return (
    <header className="app-header" role="banner">
      <div>
        <div className="brand">SPE Workbench</div>
        <div className="meta">
          Universal Web/PWA client · session-local · not a release · NEW_IMPLEMENTATION
        </div>
      </div>
      <div className="pills" aria-label="Session status">
        <span className={`pill ${online ? "ok" : "warn"}`} aria-live="polite">
          {online ? "Online shell" : "Offline shell"}
        </span>
        <PrivacyIndicator
          sensitivity={sensitivity}
          trust={trust}
          authority={authority}
        />
      </div>
    </header>
  );
}
