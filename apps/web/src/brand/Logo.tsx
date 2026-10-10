type Props = {
  size?: "sm" | "md" | "lg" | "hero";
  wordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: { w: 32, h: 32 },
  md: { w: 40, h: 40 },
  lg: { w: 56, h: 56 },
  hero: { w: 480, h: 142 },
};

/**
 * Official Vector Black & White SPE Logo.
 * Pure geometric compound vector paths with transparent negative space.
 * Automatically adapts via currentColor to dark (crisp white) and light (crisp black) modes.
 */
export function Logo({ size = "md", wordmark = true, className = "" }: Props) {
  const { w, h } = sizes[size];
  const hero = size === "hero";

  return (
    <span className={`spe-logo ${className}`} data-size={size}>
      {hero ? (
        <svg
          width={w}
          height={h}
          viewBox="0 0 1280 380"
          role="img"
          className="spe-logo-mark spe-logo-lockup-svg"
          aria-hidden="false"
          fill="none"
        >
          <title>SPE — System Prompt Engine</title>
          {/* Left Emblem */}
          <g fill="currentColor">
            <path
              d="M 190.9,98.9 L 217.9,90.3 L 220.1,34.9 L 291.9,34.9 L 294.1,90.3 L 321.1,98.9 L 346.2,111.9 L 387.0,74.3 L 437.7,125.0 L 400.1,165.8 L 413.1,190.9 L 421.7,217.9 L 477.1,220.1 L 477.1,291.9 L 421.7,294.1 L 413.1,321.1 L 400.1,346.2 L 437.7,387.0 L 387.0,437.7 L 346.2,400.1 L 321.1,413.1 L 294.1,421.7 L 291.9,477.1 L 220.1,477.1 L 217.9,421.7 L 190.9,413.1 L 165.8,400.1 L 125.0,437.7 L 74.3,387.0 L 111.9,346.2 L 98.9,321.1 L 90.3,294.1 L 34.9,291.9 L 34.9,220.1 L 90.3,217.9 L 98.9,190.9 L 111.9,165.8 L 74.3,125.0 L 125.0,74.3 L 165.8,111.9 Z M 106.0 256.0 A 150.0 150.0 0 1 0 406.0 256.0 A 150.0 150.0 0 1 0 106.0 256.0 Z"
              fillRule="evenodd"
              transform="translate(-66, -66) scale(0.74)"
            />
            <path
              d="M 142 360 L 142 190 C 142 130 190 94 256 94 C 318 94 366 142 366 208 C 366 274 318 322 256 322 L 188 322 L 188 360 Z M 192.0 208.0 A 64.0 64.0 0 1 0 320.0 208.0 A 64.0 64.0 0 1 0 192.0 208.0 Z"
              fillRule="evenodd"
              transform="translate(-66, -66) scale(0.74)"
            />
            <path
              d="M 212.0 208.0 A 44.0 44.0 0 1 0 300.0 208.0 A 44.0 44.0 0 1 0 212.0 208.0 Z M 222.0 208.0 A 34.0 34.0 0 1 0 290.0 208.0 A 34.0 34.0 0 1 0 222.0 208.0 Z"
              fillRule="evenodd"
              transform="translate(-66, -66) scale(0.74)"
            />
            <path
              d="M 240.0 208.0 A 16.0 16.0 0 1 0 272.0 208.0 A 16.0 16.0 0 1 0 240.0 208.0 Z"
              transform="translate(-66, -66) scale(0.74)"
            />
          </g>
          {/* Right Typography */}
          <g fill="currentColor" transform="translate(380, 0)">
            <text
              x="0"
              y="225"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
              fontSize="185"
              fontWeight="800"
              letterSpacing="5"
            >
              SPE
            </text>
            <text
              x="6"
              y="285"
              fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
              fontSize="34"
              fontWeight="600"
              letterSpacing="8"
              opacity="0.85"
            >
              SYSTEM PROMPT ENGINE
            </text>
          </g>
        </svg>
      ) : (
        <svg
          width={w}
          height={h}
          viewBox="0 0 512 512"
          role="img"
          aria-hidden={wordmark}
          className="spe-logo-mark"
          fill="none"
        >
          <title>SPE</title>
          <g fill="currentColor">
            <path
              d="M 190.9,98.9 L 217.9,90.3 L 220.1,34.9 L 291.9,34.9 L 294.1,90.3 L 321.1,98.9 L 346.2,111.9 L 387.0,74.3 L 437.7,125.0 L 400.1,165.8 L 413.1,190.9 L 421.7,217.9 L 477.1,220.1 L 477.1,291.9 L 421.7,294.1 L 413.1,321.1 L 400.1,346.2 L 437.7,387.0 L 387.0,437.7 L 346.2,400.1 L 321.1,413.1 L 294.1,421.7 L 291.9,477.1 L 220.1,477.1 L 217.9,421.7 L 190.9,413.1 L 165.8,400.1 L 125.0,437.7 L 74.3,387.0 L 111.9,346.2 L 98.9,321.1 L 90.3,294.1 L 34.9,291.9 L 34.9,220.1 L 90.3,217.9 L 98.9,190.9 L 111.9,165.8 L 74.3,125.0 L 125.0,74.3 L 165.8,111.9 Z M 106.0 256.0 A 150.0 150.0 0 1 0 406.0 256.0 A 150.0 150.0 0 1 0 106.0 256.0 Z"
              fillRule="evenodd"
            />
            <path
              d="M 142 360 L 142 190 C 142 130 190 94 256 94 C 318 94 366 142 366 208 C 366 274 318 322 256 322 L 188 322 L 188 360 Z M 192.0 208.0 A 64.0 64.0 0 1 0 320.0 208.0 A 64.0 64.0 0 1 0 192.0 208.0 Z"
              fillRule="evenodd"
            />
            <path
              d="M 212.0 208.0 A 44.0 44.0 0 1 0 300.0 208.0 A 44.0 44.0 0 1 0 212.0 208.0 Z M 222.0 208.0 A 34.0 34.0 0 1 0 290.0 208.0 A 34.0 34.0 0 1 0 222.0 208.0 Z"
              fillRule="evenodd"
            />
            <path d="M 240.0 208.0 A 16.0 16.0 0 1 0 272.0 208.0 A 16.0 16.0 0 1 0 240.0 208.0 Z" />
          </g>
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
