import { useId } from "react";

type MarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

type WordmarkProps = {
  compact?: boolean;
  className?: string;
};

type LockupProps = MarkProps & WordmarkProps & {
  showMark?: boolean;
};

/** Semantic press mark: six inputs become one portable artifact. */
export function LogoMark({
  size = 42,
  className = "",
  title = "System Prompt Engine",
}: MarkProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      className={`spe-logo-mark ${className}`}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`${id}-metal`} x1="7" y1="6" x2="40" y2="42">
          <stop offset="0" stopColor="#e9e6de" />
          <stop offset=".42" stopColor="#777b74" />
          <stop offset=".7" stopColor="#30332f" />
          <stop offset="1" stopColor="#c8c4ba" />
        </linearGradient>
        <linearGradient id={`${id}-warm`} x1="5" y1="24" x2="43" y2="24">
          <stop offset="0" stopColor="#8d6337" />
          <stop offset=".52" stopColor="#e1b978" />
          <stop offset="1" stopColor="#b98a4e" />
        </linearGradient>
      </defs>
      <path
        d="M8 8h8v32H8M20 8h8v32h-8M32 8h8v32h-8"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="2"
        strokeLinejoin="bevel"
      />
      <g fill="none" strokeWidth="1.4" strokeLinecap="square">
        <path d="M4 15h17l7 9h16" stroke="#63806a" />
        <path d="M4 20h13l7 4h20" stroke="#b85d43" />
        <path d="M4 25h18l5-1h17" stroke={`url(#${id}-warm)`} />
        <path d="M4 30h11l9-6h20" stroke="#a7786b" />
        <path d="M4 35h16l8-11h16" stroke="#d7d0be" />
      </g>
      <path d="M40 18v12" stroke="#e9e6de" strokeWidth="2.4" />
    </svg>
  );
}

export function LogoWordmark({ compact = false, className = "" }: WordmarkProps) {
  return (
    <span className={`spe-wordmark ${className}`} data-compact={compact}>
      <strong>System Prompt Engine</strong>
      {!compact && <span>Semantic Forge</span>}
    </span>
  );
}

export function LogoLockup({
  size = 42,
  className = "",
  compact = false,
  showMark = true,
  title,
}: LockupProps) {
  return (
    <span className={`spe-logo-lockup ${className}`}>
      {showMark && <LogoMark size={size} title={title} />}
      <LogoWordmark compact={compact} />
    </span>
  );
}

/** Compatibility wrapper for source consumers; new UI uses explicit brand parts. */
export const Logo = LogoLockup;
