import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./hero-native.css";

const steps = [
  [
    "Ideas",
    "It starts with what’s on your mind.",
    "A note. A link. A question. Bring it all.",
  ],
  [
    "Meaning",
    "Keep the things that matter.",
    "What you want. What you know. What to avoid.",
  ],
  [
    "SPE",
    "Let SPE put it together.",
    "Your idea stays at the heart of the prompt.",
  ],
  [
    "Plan",
    "Give each detail a place.",
    "A role. A goal. Clear limits. A useful result.",
  ],
  [
    "Prompt",
    "Your prompt. Ready to use.",
    "Read it. Make it yours. Use it with any AI.",
  ],
] as const;
const fields = [
  ["ROLE", "Launch planner"],
  ["OBJECTIVE", "A four-week launch"],
  ["CONSTRAINTS", "Two people · $2,000"],
  ["OUTPUT", "A plan for each week"],
];
const stagger = (n: number) => ({ "--i": n }) as CSSProperties;

/** A fixed example of the journey, not an actual compilation of visitor data. */
export function HeroStory() {
  const root = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const active = reduced ? 4 : step;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    let inView = false;
    const visibility = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        visibility();
      },
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", change);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (reduced || paused || !visible || done) return;
    const timer = setTimeout(
      () => {
        if (step === 4) setDone(true);
        else setStep((n) => n + 1);
      },
      step === 4 ? 2600 : 2800,
    );
    return () => clearTimeout(timer);
  }, [step, reduced, paused, visible, done]);
  useEffect(() => {
    if (reduced) return;
    const frame = requestAnimationFrame(() => {
      root.current?.getAnimations({ subtree: true }).forEach((animation) => {
        if (paused || !visible || done) animation.pause();
        else animation.play();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [paused, visible, done, step, reduced]);
  const select = (index: number) => {
    setStep(index);
    setPaused(false);
    setDone(false);
  };
  return (
    <figure
      ref={root}
      className="spe-native-story"
      data-step={active}
      data-paused={paused || !visible || done}
      data-reduced={reduced}
      aria-label="See how an idea becomes a prompt. This is an example."
    >
      <div className="sns-scene" aria-hidden="true">
        <div className="sns-floor" />
        <svg
          className="sns-paths"
          viewBox="0 0 820 520"
          preserveAspectRatio="none"
        >
          <g fill="none" stroke="currentColor" strokeWidth=".8">
            <path d="M110 140 C220 140 205 230 370 250" />
            <path d="M75 260 C220 260 255 250 370 250" />
            <path d="M160 385 C260 385 255 260 370 250" />
            <path d="M450 250 C540 250 500 150 690 150" />
            <path d="M450 250 C540 250 560 250 690 250" />
            <path d="M450 250 C540 250 515 380 690 380" />
          </g>
        </svg>
        <div className="sns-inputs">
          <div className="sns-fragment sns-note" style={stagger(0)}>
            <span className="sns-filetype">
              Aa <small>Note</small>
            </span>
            <p>
              I have an idea
              <br />
              for an app.
            </p>
            <span className="sns-note-rule" />
          </div>
          <div className="sns-fragment sns-question" style={stagger(1)}>
            <span className="sns-filetype">
              ? <small>Question</small>
            </span>
            <p>
              How do I<br />
              get started?
            </p>
          </div>
          <div className="sns-fragment sns-image" style={stagger(2)}>
            <svg viewBox="0 0 130 72">
              <rect width="130" height="72" rx="2" />
              <circle cx="99" cy="18" r="9" />
              <path d="M0 64 37 25 72 64M55 72 93 35 130 67" />
            </svg>
            <small>My moodboard</small>
          </div>
          <div className="sns-fragment sns-document" style={stagger(3)}>
            <span className="sns-filetype">
              ≡ <small>My notes</small>
            </span>
            <p>
              2 people
              <br />4 weeks
              <br />
              $2,000
            </p>
          </div>
          <div className="sns-fragment sns-wave" style={stagger(4)}>
            <svg viewBox="0 0 130 30">
              {[
                8, 14, 23, 13, 28, 19, 10, 26, 30, 16, 22, 9, 17, 25, 14, 7,
              ].map((h, i) => (
                <path key={i} d={`M${5 + i * 8} ${(30 - h) / 2}v${h}`} />
              ))}
            </svg>
            <small>“No paid ads.”</small>
          </div>
          <div className="sns-fragment sns-url" style={stagger(5)}>
            <span>↗</span>
            <small>my-app.example</small>
          </div>
        </div>
        <div className="sns-meaning">
          <div className="sns-glass sns-glass-back" />
          <div className="sns-glass sns-glass-front">
            <span className="sns-glass-title">What matters</span>
            {[
              ["GOAL", "Launch my app"],
              ["CONTEXT", "Two people. Four weeks."],
              ["BOUNDARY", "No paid ads."],
            ].map(([label, text], i) => (
              <div className="sns-group" style={stagger(i)} key={label}>
                <small>{label}</small>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sns-engine">
          <span className="sns-engine-top">YOUR IDEA, CONNECTED</span>
          <strong>
            SPE<span>Ω</span>
          </strong>
          <div className="sns-engine-seam" />
          <small>SYSTEM PROMPT ENGINE</small>
          <span className="sns-engine-dot" />
        </div>
        <div className="sns-output-fields">
          {fields.map(([label, text], i) => (
            <div className="sns-field" style={stagger(i)} key={label}>
              <small>{label}</small>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <div className="sns-paper-stack">
          <div className="sns-paper-back" />
          <article className="sns-artifact">
            <header>
              <span>SPE</span>
              <small>YOUR PROMPT</small>
              <span>↗</span>
            </header>
            <h3>
              Let’s launch
              <br />
              your app.
            </h3>
            <div className="sns-prompt-lines">
              {[
                "Act as a product launch planner.",
                "Create a four-week plan for my app.",
                "Keep it within $2,000, with two people and no paid ads.",
                "Give me tasks and a goal for each week.",
              ].map((line, i) => (
                <p style={stagger(i)} key={line}>
                  {line}
                </p>
              ))}
            </div>
            <footer>
              YOURS TO REVIEW <span>✓</span>
            </footer>
          </article>
        </div>
      </div>
      <figcaption className="sns-caption">
        <span className="sns-example">SEE AN EXAMPLE</span>
        <h2>{steps[active][1]}</h2>
        <p>{steps[active][2]}</p>
      </figcaption>
      <div className="sns-controls">
        <div
          className="sns-steps"
          role="group"
          aria-label="Steps from idea to prompt"
        >
          {steps.map(([label], i) => (
            <button
              type="button"
              key={label}
              aria-label={`Show ${label.toLowerCase()} step`}
              aria-pressed={active === i}
              disabled={reduced}
              onClick={() => select(i)}
            >
              <span className="sns-step-line" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            className="sns-play"
            type="button"
            aria-label={
              done ? "Replay story" : paused ? "Play story" : "Pause story"
            }
            onClick={() => {
              if (done) {
                setStep(0);
                setDone(false);
                setPaused(false);
              } else setPaused((p) => !p);
            }}
          >
            <span aria-hidden="true">{done ? "↺" : paused ? "▷" : "Ⅱ"}</span>
          </button>
        )}
        {reduced && <span className="sns-motion-off">Motion off</span>}
      </div>
      <div className="visually-hidden">
        <h2>How SPE works</h2>
        <ol>
          <li>
            Start with messy thoughts: a note, question, image, document, voice
            note or link.
          </li>
          <li>Find the meaning: your goal, the details and what to avoid.</li>
          <li>SPE puts your idea together.</li>
          <li>
            Add structure: a role, an objective, constraints and the output you
            want.
          </li>
          <li>Read your finished prompt, edit it and use it with any AI.</li>
        </ol>
        <p>
          Example prompt: Act as a product launch planner. Create a four-week
          plan for my app. Keep it within $2,000, with two people and no paid
          ads. Give me tasks and a goal for each week.
        </p>
      </div>
    </figure>
  );
}
