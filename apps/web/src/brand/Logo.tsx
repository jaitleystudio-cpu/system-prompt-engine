type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  wordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: { w: 36, h: 36 },
  md: { w: 40, h: 40 },
  lg: { w: 56, h: 56 },
  hero: { w: 440, h: 150 },
};

/**
 * Replaceable SPE Logo — metal mark with cyan→amber circuit channels.
 * Approved wording only: SPE / SYSTEM PROMPT ENGINE.
 */
export function Logo({ size = "md", wordmark = true, className = "" }: Props) {
  const { w, h } = sizes[size];
  const gid = `speMark-${size}`;
  const hero = size === "hero";
  return (
    <span className={`spe-logo ${className}`} data-size={size}>
      {hero ? (
        <svg width={w} height={h} viewBox="0 0 520 180" role="img" className="spe-logo-mark" aria-hidden="false">
          <title>SPE — System Prompt Engine</title>
          <defs>
            <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f4f7fb" />
              <stop offset="40%" stopColor="#a7b0be" />
              <stop offset="70%" stopColor="#e8edf4" />
              <stop offset="100%" stopColor="#6a7382" />
            </linearGradient>
            <linearGradient id={`${gid}-c`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3db8ff" />
              <stop offset="100%" stopColor="#ff9a3c" />
            </linearGradient>
            <filter id={`${gid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <text
            x="260"
            y="108"
            textAnchor="middle"
            fill={`url(#${gid}-metal)`}
            fontFamily="'Avenir Next Condensed', 'Segoe UI', system-ui, sans-serif"
            fontWeight="800"
            fontSize="118"
            letterSpacing="-6"
          >
            SPE
          </text>
          <g fill="none" stroke={`url(#${gid}-c)`} strokeWidth="3" strokeLinecap="round" filter={`url(#${gid}-glow)`}>
            <path d="M90 72h40M90 92h50M90 112h30" />
            <circle cx="130" cy="72" r="3" fill="#3db8ff" stroke="none" />
            <path d="M210 70h48M210 94h58M210 118h36" />
            <circle cx="268" cy="118" r="3" fill="#ff9a3c" stroke="none" />
            <path d="M340 72h48M340 96h56M340 120h32" />
            <circle cx="396" cy="72" r="3" fill="#ff9a3c" stroke="none" />
          </g>
          <text
            x="260"
            y="160"
            textAnchor="middle"
            fill="#c9d0da"
            fontFamily="Avenir Next, Segoe UI, system-ui, sans-serif"
            fontSize="18"
            letterSpacing="8"
          >
            SYSTEM PROMPT ENGINE
          </text>
        </svg>
      ) : (
        <svg width={w} height={h} viewBox="0 0 64 64" aria-hidden="true" className="spe-logo-mark">
          <defs>
            <linearGradient id={`${gid}-metal`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e8edf4" />
              <stop offset="100%" stopColor="#7a8494" />
            </linearGradient>
            <linearGradient id={`${gid}-c`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3db8ff" />
              <stop offset="100%" stopColor="#ff9a3c" />
            </linearGradient>
          </defs>
          <rect x="6" y="6" width="52" height="52" rx="14" fill="#0a0e14" stroke={`url(#${gid}-metal)`} strokeWidth="1.5" />
          <text
            x="32"
            y="40"
            textAnchor="middle"
            fill={`url(#${gid}-metal)`}
            fontFamily="'Avenir Next Condensed', 'Segoe UI', system-ui, sans-serif"
            fontWeight="800"
            fontSize="22"
            letterSpacing="-1"
          >
            SPE
          </text>
          <path d="M16 46h10M38 46h10" stroke={`url(#${gid}-c)`} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="26" cy="46" r="1.4" fill="#3db8ff" />
          <circle cx="48" cy="46" r="1.4" fill="#ff9a3c" />
        </svg>
      )}
      {wordmark && !hero && (
        <span className="spe-logo-text">
          <strong>SPE</strong>
          {size !== "sm" && <span>System Prompt Engine</span>}
        </span>
      )}
    </span>
  );
}
