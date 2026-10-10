/**
 * SPE Ω — Contextual Ad Container (Privacy-Preserving & Ethical)
 * Strict Constitutional Boundary: Only renders on public discovery surfaces.
 * 100% prohibited in private workspaces and execution environments.
 * 100% hidden for Developer Pro & Team subscribers and in offline mode.
 */

import React, { useState, useEffect } from "react";

export interface ContextualAdSlotProps {
  slotId: string;
  format?: "leaderboard" | "rectangle" | "badge";
  label?: string;
  className?: string;
}

interface SponsorPartner {
  name: string;
  tagline: string;
  url: string;
  badge: string;
}

const SPONSORS: SponsorPartner[] = [
  {
    name: "Neon Serverless Postgres",
    tagline: "Serverless Postgres built for scale. Branch your database like code.",
    url: "https://neon.tech",
    badge: "Database Partner",
  },
  {
    name: "Cloudflare Workers",
    tagline: "Deploy serverless code instantly across 300+ cities with zero cold starts.",
    url: "https://workers.cloudflare.com",
    badge: "Compute Partner",
  },
  {
    name: "Vercel AI SDK",
    tagline: "The open source TypeScript library for building conversational web interfaces.",
    url: "https://sdk.vercel.ai",
    badge: "Framework Partner",
  },
];

export const ContextualAdSlot: React.FC<ContextualAdSlotProps> = ({
  slotId,
  format = "leaderboard",
  label = "Sponsored Developer Partner",
  className = "",
}) => {
  const [isPro, setIsPro] = useState(() => {
    try {
      const tier = localStorage.getItem("spe-user-tier");
      return tier === "pro" || tier === "team";
    } catch {
      return false;
    }
  });
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [partnerIndex, setPartnerIndex] = useState(0);

  useEffect(() => {
    const handleStorage = () => {
      try {
        const tier = localStorage.getItem("spe-user-tier");
        setIsPro(tier === "pro" || tier === "team");
      } catch {
        // Storage unavailable
      }
    };
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("storage", handleStorage);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Deterministic selection based on slotId string hash
    let hash = 0;
    for (let i = 0; i < slotId.length; i++) {
      hash = (hash << 5) - hash + slotId.charCodeAt(i);
      hash |= 0;
    }
    setPartnerIndex(Math.abs(hash) % SPONSORS.length);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [slotId]);

  // Instantly suppress for Pro users or if offline
  if (isPro || isOffline) {
    return null;
  }

  const partner = SPONSORS[partnerIndex];

  const dimensions =
    format === "leaderboard"
      ? { width: "100%", maxWidth: "768px", minHeight: "84px" }
      : format === "rectangle"
      ? { width: "100%", maxWidth: "320px", minHeight: "220px" }
      : { width: "100%", maxWidth: "200px", minHeight: "60px" };

  return (
    <aside
      className={`spe-contextual-ad-slot ${className}`}
      data-ad-slot-id={slotId}
      data-copy-depth="PROOF"
      aria-label="Contextual developer advertisement"
      style={{
        margin: "1.5rem auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...dimensions,
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "0.3rem 0.6rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.6875rem",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <span>{label}</span>
        <span title="Privacy-preserving contextual developer sponsorship. Zero cookies, zero user data egress.">
          Zero Tracking · {partner.badge}
        </span>
      </div>

      <div
        style={{
          width: "100%",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#090d16",
          border: "1px dashed #1e293b",
          borderRadius: "0 0 8px 8px",
          padding: "0.85rem 1.25rem",
          gap: "1rem",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.2rem" }}>
            {partner.name}
          </div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8125rem", lineHeight: 1.4 }}>
            {partner.tagline}
          </p>
        </div>
        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            padding: "0.45rem 0.85rem",
            backgroundColor: "#1e293b",
            color: "#60a5fa",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 600,
            textDecoration: "none",
            border: "1px solid #334155",
            minHeight: "44px",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Explore ↗
        </a>
      </div>
    </aside>
  );
};
