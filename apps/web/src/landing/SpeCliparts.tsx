interface ClipartProps {
  size?: number;
  className?: string;
  glowColor?: string;
}

/**
 * 1. COMPILER BOT CLIPART
 * Friendly cyber-compiler bot with glowing visor and floating code blocks.
 */
export function CompilerBotClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-cb-body" x1="16" y1="18" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e2433" />
          <stop offset="1" stopColor="#0f131a" />
        </linearGradient>
        <linearGradient id="spe-cb-visor" x1="22" y1="28" x2="42" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1fe17" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="spe-cb-glow" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1fe17" stopOpacity="0.3" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Background Aura */}
      <circle cx="32" cy="32" r="28" fill="url(#spe-cb-glow)" />
      {/* Antennas */}
      <path d="M32 18V10" stroke="#d1fe17" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="8" r="3" fill="#d1fe17" />
      <path d="M22 16L17 11" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 16L47 11" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
      {/* Head Chassis */}
      <rect x="15" y="18" width="34" height="30" rx="10" fill="url(#spe-cb-body)" stroke="#38bdf8" strokeWidth="1.5" />
      {/* Glowing Visor Screen */}
      <rect x="21" y="27" width="22" height="11" rx="5" fill="#090c10" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <rect x="23" y="29" width="18" height="7" rx="3.5" fill="url(#spe-cb-visor)" />
      {/* Happy Expressive Compiler Eyes */}
      <circle cx="28" cy="32.5" r="1.5" fill="#090c10" />
      <circle cx="36" cy="32.5" r="1.5" fill="#090c10" />
      {/* Floating Code Cubes */}
      <rect x="9" y="32" width="5" height="5" rx="1.5" fill="#d1fe17" opacity="0.85" />
      <rect x="50" y="26" width="6" height="6" rx="2" fill="#38bdf8" opacity="0.85" />
      <rect x="47" y="42" width="5" height="5" rx="1.5" fill="#fbbf24" opacity="0.8" />
      {/* Chest Invariant Badge */}
      <path d="M30 43H34" stroke="#d1fe17" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 2. GUARDIAN SHIELD CLIPART
 * Layered defense shield blocking red injection vectors with energy barrier.
 */
export function GuardianShieldClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-gs-plate" x1="18" y1="12" x2="46" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="spe-gs-rim" x1="16" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.6" stopColor="#d1fe17" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      {/* Pulse Rings */}
      <circle cx="32" cy="32" r="26" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.3" />
      {/* Outer Deflection Sparks */}
      <path d="M12 20L15 23" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 32L14 32" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      {/* Main Shield Body */}
      <path
        d="M32 10L48 16V30C48 41.5 41.2 50.8 32 54C22.8 50.8 16 41.5 16 30V16L32 10Z"
        fill="url(#spe-gs-plate)"
        stroke="url(#spe-gs-rim)"
        strokeWidth="2"
      />
      {/* Inner Energy Core */}
      <path
        d="M32 16L43 20.8V30C43 38.6 38.3 45.6 32 48.2C25.7 45.6 21 38.6 21 30V20.8L32 16Z"
        fill="rgba(56, 189, 248, 0.12)"
        stroke="#d1fe17"
        strokeWidth="1.2"
      />
      {/* Central Check Lock Emblem */}
      <circle cx="32" cy="31" r="6" fill="#d1fe17" />
      <path d="M29.5 31L31.2 32.8L34.8 29.2" stroke="#090a0f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 3. SPATIAL 3D CUBE CLIPART
 * Isometric spatial wireframe cube with floating coordinate axes.
 */
export function SpatialCubeClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-sc-top" x1="16" y1="18" x2="48" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="spe-sc-left" x1="16" y1="28" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="spe-sc-right" x1="32" y1="28" x2="48" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#312e81" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* Orbital Ring */}
      <ellipse cx="32" cy="34" rx="26" ry="12" stroke="#d1fe17" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      {/* Top Face */}
      <path d="M32 14L48 23L32 32L16 23L32 14Z" fill="url(#spe-sc-top)" stroke="#ffffff" strokeWidth="1" />
      {/* Left Face */}
      <path d="M16 23L32 32V50L16 41V23Z" fill="url(#spe-sc-left)" stroke="#38bdf8" strokeWidth="1" />
      {/* Right Face */}
      <path d="M32 32L48 23V41L32 50V32Z" fill="url(#spe-sc-right)" stroke="#818cf8" strokeWidth="1" />
      {/* Glowing Vertex Dots */}
      <circle cx="32" cy="14" r="2.5" fill="#d1fe17" />
      <circle cx="16" cy="23" r="2" fill="#38bdf8" />
      <circle cx="48" cy="23" r="2" fill="#38bdf8" />
      <circle cx="32" cy="32" r="2.5" fill="#ffffff" />
      <circle cx="32" cy="50" r="2" fill="#d1fe17" />
    </svg>
  );
}

/**
 * 4. MULTI-AGENT SYNC CLIPART
 * Interconnected agent avatars lowering into universal formats.
 */
export function MultiAgentSyncClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-mas-core" x1="22" y1="22" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1fe17" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {/* Connecting Laser Beams */}
      <path d="M32 32L18 18" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M32 32L46 18" stroke="#a855f7" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M32 32L18 46" stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M32 32L46 46" stroke="#f43f5e" strokeWidth="2" strokeDasharray="3 3" />
      {/* Outer Agent Satellites */}
      <circle cx="18" cy="18" r="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="2.5" fill="#38bdf8" />

      <circle cx="46" cy="18" r="6" fill="#1e293b" stroke="#a855f7" strokeWidth="1.5" />
      <circle cx="46" cy="18" r="2.5" fill="#a855f7" />

      <circle cx="18" cy="46" r="6" fill="#1e293b" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="18" cy="46" r="2.5" fill="#fbbf24" />

      <circle cx="46" cy="46" r="6" fill="#1e293b" stroke="#f43f5e" strokeWidth="1.5" />
      <circle cx="46" cy="46" r="2.5" fill="#f43f5e" />

      {/* Central Compiler Hub */}
      <circle cx="32" cy="32" r="10" fill="#0f172a" stroke="url(#spe-mas-core)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="4" fill="#d1fe17" />
    </svg>
  );
}

/**
 * 5. VOICE WAVE CLIPART
 * Studio microphone turning messy voice notes into clean instructions.
 */
export function VoiceWaveClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-vw-mic" x1="26" y1="12" x2="38" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      {/* Left Audio Waves */}
      <path d="M12 24C12 24 16 26 16 32C16 38 12 40 12 40" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M7 20C7 20 12 23 12 32C12 41 7 44 7 44" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Right Audio Waves */}
      <path d="M52 24C52 24 48 26 48 32C48 38 52 40 52 40" stroke="#d1fe17" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M57 20C57 20 52 23 52 32C52 41 57 44 57 44" stroke="#d1fe17" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* Microphone Capsule */}
      <rect x="26" y="14" width="12" height="20" rx="6" fill="url(#spe-vw-mic)" stroke="#ffffff" strokeWidth="1" />
      {/* Mic Grill Lines */}
      <line x1="28" y1="20" x2="36" y2="20" stroke="#090a0f" strokeWidth="1" opacity="0.4" />
      <line x1="28" y1="24" x2="36" y2="24" stroke="#090a0f" strokeWidth="1" opacity="0.4" />
      {/* Cradle */}
      <path d="M21 28C21 34.6 25.9 40 32 40C38.1 40 43 34.6 43 28" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      {/* Stand Base */}
      <path d="M32 40V50" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 50H40" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 6. VISION SCANNER CLIPART
 * Viewfinder camera scanning UI into structured code.
 */
export function VisionScannerClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-vs-lens" x1="24" y1="24" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      {/* Corner Viewfinders */}
      <path d="M12 20V14H18" stroke="#d1fe17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 20V14H46" stroke="#d1fe17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 44V50H18" stroke="#d1fe17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 44V50H46" stroke="#d1fe17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Laser Scanning Line */}
      <line x1="14" y1="32" x2="50" y2="32" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* Camera / Eye Iris */}
      <circle cx="32" cy="32" r="14" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="8" fill="url(#spe-vs-lens)" />
      <circle cx="30" cy="30" r="2.5" fill="#ffffff" />
    </svg>
  );
}

/**
 * 7. RESEARCH CODEX CLIPART
 * Open holobook distilling specifications into clean Horn logic.
 */
export function ResearchCodexClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-rc-pages" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* Floating Knowledge Sparkles */}
      <circle cx="16" cy="14" r="1.5" fill="#d1fe17" />
      <circle cx="48" cy="14" r="1.5" fill="#d1fe17" />
      <circle cx="32" cy="10" r="2" fill="#fbbf24" />
      {/* Book Cover Wings */}
      <path d="M32 20C26 16 16 16 12 18V48C16 46 26 46 32 50C38 46 48 46 52 48V18C48 16 38 16 32 20Z" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
      {/* Glowing Left Page */}
      <path d="M32 22C26 18 18 18 14 20V46C18 44 26 44 32 48V22Z" fill="url(#spe-rc-pages)" opacity="0.8" />
      {/* Page Inscription Lines */}
      <line x1="18" y1="28" x2="28" y2="28" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="34" x2="26" y2="34" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="40" x2="28" y2="40" stroke="#d1fe17" strokeWidth="1.5" strokeLinecap="round" />
      {/* Spine Ribbon */}
      <path d="M32 20V50" stroke="#d1fe17" strokeWidth="2" />
    </svg>
  );
}

/**
 * 8. RADAR SENTINEL CLIPART
 * Satellite dish / radar scanner sweeping for model regressions.
 */
export function RadarSentinelClipart({ size = 56, className = "" }: ClipartProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spe-rs-sweep" x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
      </defs>
      {/* Radar Ring Sweeps */}
      <circle cx="32" cy="32" r="22" stroke="#10b981" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      <circle cx="32" cy="32" r="14" stroke="#10b981" strokeWidth="1" opacity="0.6" />
      <circle cx="32" cy="32" r="6" fill="#10b981" />
      {/* Radar Sweep Ray */}
      <path d="M32 32L46 18" stroke="#d1fe17" strokeWidth="2" strokeLinecap="round" />
      {/* Target Blips */}
      <circle cx="44" cy="24" r="2.5" fill="#d1fe17" />
      <circle cx="22" cy="38" r="2" fill="#38bdf8" />
    </svg>
  );
}

/**
 * STORYTELLING CINEMA (AGENT SENTINEL) 8-STAGE SCENE CLIPARTS
 */

export function TangledKnotClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(244, 63, 94, 0.12)" stroke="#f43f5e" strokeWidth="1.5" />
      {/* Tangled Unruly Yarn / Wire Loop */}
      <path d="M16 20C18 14 26 14 28 20C30 26 18 24 16 30C14 36 24 36 32 30" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="33" cy="18" r="2" fill="#fbbf24" />
      <circle cx="15" cy="31" r="1.5" fill="#f43f5e" />
    </svg>
  );
}

export function FrozenCrystalClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" strokeWidth="1.5" />
      {/* Hexagonal Crystal Lock */}
      <path d="M24 12L34 18V30L24 36L14 30V18L24 12Z" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
      <path d="M24 12V36" stroke="#d1fe17" strokeWidth="1.5" />
      <path d="M14 18L34 30" stroke="#38bdf8" strokeWidth="1.2" />
      <path d="M14 30L34 18" stroke="#38bdf8" strokeWidth="1.2" />
    </svg>
  );
}

export function LogicScaleClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(209, 254, 23, 0.12)" stroke="#d1fe17" strokeWidth="1.5" />
      {/* Balance Scale in Perfect Equilibrium */}
      <path d="M24 14V34" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 20H34" stroke="#d1fe17" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 20L11 26H17L14 20Z" fill="#38bdf8" />
      <path d="M34 20L31 26H37L34 20Z" fill="#38bdf8" />
      <path d="M18 34H30" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ForcefieldShieldClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" strokeWidth="1.5" />
      <path d="M24 12L34 16V24C34 30 29 35 24 37C19 35 14 30 14 24V16L24 12Z" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
      {/* Blocked Laser Spikes */}
      <path d="M10 20L13 22" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 28L13 28" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill="#d1fe17" />
    </svg>
  );
}

export function OrbitRouterClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(168, 85, 247, 0.12)" stroke="#a855f7" strokeWidth="1.5" />
      <ellipse cx="24" cy="24" rx="14" ry="7" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 3" />
      <circle cx="24" cy="24" r="5" fill="#d1fe17" />
      <circle cx="14" cy="21" r="2.5" fill="#a855f7" />
      <circle cx="34" cy="27" r="2.5" fill="#38bdf8" />
    </svg>
  );
}

export function FirewallGateClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" strokeWidth="1.5" />
      {/* Intercept Barrier Gate */}
      <rect x="14" y="16" width="20" height="16" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
      <path d="M14 24H34" stroke="#f43f5e" strokeWidth="2" />
      <circle cx="24" cy="24" r="3" fill="#d1fe17" />
    </svg>
  );
}

export function WaxSealReceiptClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(251, 191, 36, 0.12)" stroke="#fbbf24" strokeWidth="1.5" />
      {/* Scroll Document */}
      <path d="M16 12H30L34 16V34H16V12Z" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
      {/* Golden Seal Stamp */}
      <circle cx="25" cy="27" r="6" fill="#fbbf24" stroke="#d1fe17" strokeWidth="1.2" />
      <path d="M23 27L24.5 28.5L27.5 25.5" stroke="#090a0f" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProductionRocketClipart({ size = 48, className = "" }: ClipartProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="rgba(52, 211, 153, 0.12)" stroke="#34d399" strokeWidth="1.5" />
      {/* Rocket Ship Ascending */}
      <path d="M24 12C28 16 29 22 28 27L24 25L20 27C19 22 20 16 24 12Z" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
      {/* Rocket Wings */}
      <path d="M19 25L15 28V31L20 29" fill="#059669" />
      <path d="M29 25L33 28V31L28 29" fill="#059669" />
      {/* Exhaust Flame */}
      <path d="M24 28L22 35L24 33L26 35L24 28Z" fill="#fbbf24" />
    </svg>
  );
}
