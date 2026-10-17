import { pathForView } from "../routing";

/**
 * Quiet editorial close under the native hero.
 * The hero already tells the transformation story, so this section does not
 * add a second visual sequence.
 */
export function HomeQuiet({
  onCreate,
  onCode,
}: {
  onCreate: () => void;
  onCode: () => void;
}) {
  return (
    <section className="spe-home-quiet" aria-labelledby="home-quiet-title">
      <p className="eyebrow">After the story</p>
      <h2 id="home-quiet-title">A clear prompt, without another show.</h2>
      <div className="spe-home-quiet-grid">
        <article>
          <p className="spe-home-quiet-kicker">What SPE does</p>
          <h3>It turns a rough idea into a prompt you can read.</h3>
          <p>
            Write what you want to do. SPE keeps your goal, the limits you set,
            and the questions still open, then shows a prompt you can review
            before you use it.
          </p>
        </article>
        <article>
          <p className="spe-home-quiet-kicker">Why it is different</p>
          <h3>Preparation stays in this browser.</h3>
          <p>
            SPE does not send your idea to an AI company to write the prompt.
            You decide whether to copy it, save a file, or take it somewhere
            else yourself.
          </p>
        </article>
        <article>
          <p className="spe-home-quiet-kicker">What you can do next</p>
          <h3>Start the task, or open a saved file later.</h3>
          <p>
            Build a prompt in Prompt Studio, or start from a screenshot in S-Code. Saved
            work stays on this device unless you export it.
          </p>
          <div className="spe-home-quiet-actions">
            <a
              className="spe-build"
              href={pathForView("create")}
              onClick={(event) => {
                event.preventDefault();
                onCreate();
              }}
            >
              Open Prompt Studio Free <span>↗</span>
            </a>
            <a
              className="spe-ghost"
              href={pathForView("code")}
              onClick={(event) => {
                event.preventDefault();
                onCode();
              }}
            >
              Start with S-Code <span>↗</span>
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
