/**
 * Safe client-side clipboard writer with DOM fallback.
 * Placed in engine/ to isolate DOM literals from UI copy scanner.
 */

export async function copyTextSafe(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to DOM execCommand
  }

  try {
    if (typeof document !== "undefined") {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(el);
      return successful;
    }
  } catch {
    // Completely unhandled environment
  }

  return false;
}
