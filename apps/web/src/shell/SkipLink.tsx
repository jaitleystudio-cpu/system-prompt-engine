/** First focusable control. Moves focus to #main without a full reload. */
export function SkipLink() {
  return (
    <a
      className="skip-link"
      href="#main"
      onClick={(event) => {
        event.preventDefault();
        const main = document.getElementById("main");
        main?.focus({ preventScroll: false });
        main?.scrollIntoView();
      }}
    >
      Skip to main content
    </a>
  );
}
