/** Move focus to #main after an in-app view change, never on the first load. */
export function focusMainAfterNavigation(isInitialMount: { current: boolean }): void {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    return;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  document.getElementById("main")?.focus({ preventScroll: true });
}
