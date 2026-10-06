import { existsSync } from "node:fs";

/**
 * Robust cross-platform Chrome executable resolution.
 * Checks environment variable, followed by standard OS-specific paths.
 */
export function resolveChromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/local/bin/google-chrome",
    "/snap/bin/chromium",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return process.env.CHROME_PATH || undefined;
}

/**
 * Returns standard Playwright Chromium launch options configured for
 * cross-platform safety (headless, no-sandbox for containers/root, and
 * platform-appropriate ANGLE graphics backend).
 */
export function getBrowserLaunchOptions(overrides = {}) {
  const chromePath = resolveChromePath();
  const baseArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    ...(process.platform === "darwin" ? ["--use-angle=metal"] : []),
  ];

  const { args = [], ...rest } = overrides;

  return {
    ...(chromePath ? { executablePath: chromePath } : {}),
    headless: true,
    args: [...baseArgs, ...args],
    ...rest,
  };
}
