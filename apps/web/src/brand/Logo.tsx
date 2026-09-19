type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  wordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: 18,
  md: 28,
  lg: 40,
  hero: 72,
};

/** Replaceable SPE Logo — vector mark + optional wordmark. */
export function Logo({ size = "md", wordmark = true, className = "" }: Props) {
  const px = sizes[size];
  return (
    <span className={`spe-logo ${className}`} data-size={size}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="spe-logo-mark"
      >
        <defs>
          <linearGradient id="speMarkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e2c89a" />
            <stop offset="55%" stopColor="#7eb8c9" />
            <stop offset="100%" stopColor="#c4a574" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="28" fill="none" stroke="url(#speMarkGrad)" strokeWidth="1.5" opacity="0.55" />
        <path
          d="M18 40c6-16 10-22 14-22s8 6 14 22"
          fill="none"
          stroke="url(#speMarkGrad)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="32" cy="22" r="3.2" fill="#e2c89a" />
        <circle cx="20" cy="38" r="2.2" fill="#7eb8c9" />
        <circle cx="44" cy="38" r="2.2" fill="#c4a574" />
        <path d="M22 38h20" stroke="rgba(242,238,230,0.35)" strokeWidth="1" />
      </svg>
      {wordmark && (
        <span className="spe-logo-text">
          <strong>SPE</strong>
          {size !== "sm" && <span>System Prompt Engine</span>}
        </span>
      )}
    </span>
  );
}
