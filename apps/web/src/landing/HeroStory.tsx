import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./hero-native.css";

const meaning = [
  ["GOAL", "Launch the writing app"],
  ["CONTEXT", "Two people. Four weeks."],
  ["BOUNDARY", "Stay within $2,000"],
];
const output = [
  ["ROLE", "Product launch strategist"],
  ["OBJECTIVE", "Plan a four-week launch"],
  ["CONSTRAINTS", "Two people · $2,000 · no paid ads"],
  ["OUTPUT", "Weekly actions & success measures"],
];
const timing = (n: number) => ({ "--n": n } as CSSProperties);

/** Illustrative story, not a live compile or a promise of model correctness. */
export function HeroStory() {
  const root = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    const node = root.current;
    let inView = false;
    const visibility = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility(); });
    if (node) observer.observe(node);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", update); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return (
    <figure ref={root} className="spe-native-story" aria-label="From a messy human idea to meaning, SPE, structure, and a perfect prompt. Illustrative example."
      data-paused={paused || !visible} data-reduced={reduced} data-done={done}>
      <div className="sns-top"><span>THE SHAPE OF AN IDEA</span><span>ILLUSTRATIVE EXAMPLE</span></div>
      <div className="sns-sequence" key={replay}>
        <section className="sns-thought" aria-label="Messy human thought">
          <h2><span>01</span> Messy human thought</h2>
          <div className="sns-fragments">
            <div className="sns-fragment sns-note" style={timing(0)}><small>NOTE</small><strong>Let’s launch<br />something good.</strong><i aria-hidden="true" /></div>
            <div className="sns-fragment sns-question" style={timing(1)}><small>QUESTION</small><span>Where do we start?</span></div>
            <div className="sns-fragment sns-image" style={timing(2)}><small>IMAGE</small><svg viewBox="0 0 100 44" aria-hidden="true"><rect x="1" y="1" width="98" height="42" rx="3"/><circle cx="74" cy="12" r="5"/><path d="M4 39 30 15 51 34 65 22 96 40"/></svg></div>
            <div className="sns-fragment sns-document" style={timing(3)}><small>DOCUMENT</small><span>Launch brief</span><span className="sns-mini-lines" aria-hidden="true" /></div>
            <div className="sns-fragment sns-wave" style={timing(4)}><small>VOICE NOTE</small><svg viewBox="0 0 130 24" aria-hidden="true">{[6,12,8,20,14,24,10,16,22,12,6,18,10,20,8,14,6].map((h,i)=><path key={i} d={`M${4+i*7.5} ${(24-h)/2}v${h}`} />)}</svg><span>“Two people. No paid ads.”</span></div>
            <div className="sns-fragment sns-url" style={timing(5)}><small>URL</small><span>our-app.example ↗</span></div>
          </div>
        </section>
        <section className="sns-meaning" aria-label="Meaning">
          <h2><span>02</span> Meaning</h2>
          <p className="sns-subtitle">Keep what matters.</p>
          <div className="sns-extractions" aria-hidden="true">{["Launch the app", "Two people", "$2,000 limit"].map((text,i)=><span key={text} style={timing(i)}>{text}</span>)}</div>
          <div className="sns-groups">{meaning.map(([label,text],i)=><div className="sns-group" key={label} style={timing(i)}><span>{label}</span><p>{text}</p></div>)}</div>
        </section>
        <section className="sns-transform" aria-label="SPE transformation">
          <div className="sns-connector" aria-hidden="true"><i /></div>
          <div className="sns-seal"><span className="sns-seal-rule" aria-hidden="true"/><strong>SPE<span>Ω</span></strong><small>SYSTEM PROMPT ENGINE</small></div>
          <div className="sns-transform-copy"><h2><span>03</span> SPE</h2><p>Your intent.<br /><em>Given structure.</em></p></div>
          <div className="sns-connector" aria-hidden="true"><i /></div>
        </section>
        <section className="sns-structure" aria-label="Structure">
          <h2><span>04</span> Structure</h2>
          <p className="sns-subtitle">A place for every detail.</p>
          <div className="sns-fields">{output.map(([label,text],i)=><div className="sns-field" key={label} style={timing(i)}><span>{label}</span><p>{text}</p></div>)}</div>
        </section>
        <section className="sns-prompt" aria-label="Perfect prompt">
          <h2><span>05</span> Perfect prompt</h2>
          <article className="sns-artifact" aria-label="Assembled example prompt">
            <header><span>SPE / YOUR PROMPT</span><span aria-hidden="true">↗</span></header>
            <h3>A launch with intention.</h3>
            <div className="sns-prompt-lines">{[
              "Act as a product launch strategist.",
              "Plan a four-week launch for our writing app.",
              "Work with two people and $2,000. No paid ads.",
              "Return weekly actions and success measures.",
            ].map((text,i)=><p key={text} style={timing(i)}>{text}</p>)}</div>
            <footer>READY TO REVIEW <span aria-hidden="true">✓</span></footer>
          </article>
        </section>
        <span className="sns-clock" aria-hidden="true" onAnimationEnd={() => setDone(true)} />
      </div>
      <figcaption className="sns-footer"><span>Your thought, carried through.<small>Review the prompt before using it.</small></span>
        {!reduced && <button type="button" onClick={() => { if(done) { setReplay(n=>n+1); setDone(false); setPaused(false); } else setPaused(p=>!p); }} aria-label={done ? "Replay story" : paused ? "Resume story" : "Pause story"}>{done ? "Replay story ↺" : paused ? "Resume story ▷" : "Pause story Ⅱ"}</button>}
        {reduced && <span className="sns-still">Complete story · motion off</span>}
      </figcaption>
      <p className="visually-hidden">MESSY HUMAN THOUGHT → MEANING → SPE → STRUCTURE → PERFECT PROMPT. Notes, a question, an image, a document, voice and a URL become a goal, context and boundary. SPE organizes these into role, objective, constraints and output, then assembles a prompt for you to review. This is an illustrative example, not a live compilation.</p>
    </figure>
  );
}
