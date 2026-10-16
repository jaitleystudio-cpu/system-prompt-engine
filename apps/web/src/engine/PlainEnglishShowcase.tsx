import { useState, useEffect, useMemo } from "react";
import { copyTextSafe } from "./workflows/clipboard";
import "./plain-english-showcase.css";

export interface PlainEnglishShowcaseProps {
  onNavigate?: (view: any) => void;
  onSelectPrompt?: (promptText: string) => void;
}

export interface PresetItem {
  id: string;
  name: string;
  category: string;
  rawText: string;
  phrases: {
    prefix?: string;
    role: string;
    mid1?: string;
    goal: string;
    mid2?: string;
    constraint: string;
    mid3?: string;
    output: string;
    suffix?: string;
  };
  slots: {
    role: string;
    goal: string;
    constraint: string;
    output: string;
  };
  vagueComparison: {
    badPrompt: string;
    risks: string[];
  };
}

export const PRESETS: PresetItem[] = [
  {
    id: "bike-shop",
    name: "Bike Shop Assistant",
    category: "Support & Operations",
    rawText:
      "I need a support assistant for my bike shop that helps people pick the right repair. Never promise refunds, and keep answers short, with a price range.",
    phrases: {
      prefix: "I need a ",
      role: "support assistant for my bike shop",
      mid1: " that ",
      goal: "helps people pick the right repair",
      mid2: ". ",
      constraint: "Never promise refunds",
      mid3: ", and ",
      output: "keep answers short, with a price range",
      suffix: ".",
    },
    slots: {
      role: "Support assistant for an independent bike repair shop.",
      goal: "Help the customer choose the right repair for their problem.",
      constraint: "Do not promise or imply refunds. Refer billing questions to staff.",
      output: "Two to four sentences. End with an estimated price range.",
    },
    vagueComparison: {
      badPrompt: "make a bot for my bike shop to help people and don't give refunds and keep it short",
      risks: [
        "Vague role boundaries lead to hallucinated inventory",
        "Implicit refund policy bypassed by adversarial users",
        "Uncalibrated price format causes customer disputes",
      ],
    },
  },
  {
    id: "code-refactor",
    name: "TypeScript Refactor Bot",
    category: "Engineering & Architecture",
    rawText:
      "Act as a senior TypeScript architect that refactors legacy async callbacks to async/await. Never change external function signatures or delete tests, and return only the unified git diff with explanations.",
    phrases: {
      prefix: "Act as a ",
      role: "senior TypeScript architect",
      mid1: " that ",
      goal: "refactors legacy async callbacks to async/await",
      mid2: ". ",
      constraint: "Never change external function signatures or delete tests",
      mid3: ", and ",
      output: "return only the unified git diff with explanations",
      suffix: ".",
    },
    slots: {
      role: "Senior TypeScript architect specializing in legacy refactoring.",
      goal: "Refactor nested asynchronous callback code into clean async/await patterns.",
      constraint: "Preserve all external API signatures and never weaken, skip, or remove tests.",
      output: "Unified git diff format accompanied by concise inline architectural notes.",
    },
    vagueComparison: {
      badPrompt: "refactor my callback code into async await don't break tests give me git diff",
      risks: [
        "Agent modifies external types and breaks downstream consumers",
        "Agent comments out failing unit tests instead of fixing logic",
        "Markdown formatting leaks raw explanations into file output",
      ],
    },
  },
  {
    id: "growth-analyst",
    name: "Cohort Growth Analyst",
    category: "Product & Analytics",
    rawText:
      "You are a SaaS growth intelligence analyst that evaluates weekly cohort retention curves. Do not extrapolate assumptions beyond 90-day data, and format findings as an executive markdown table followed by three action items.",
    phrases: {
      prefix: "You are a ",
      role: "SaaS growth intelligence analyst",
      mid1: " that ",
      goal: "evaluates weekly cohort retention curves",
      mid2: ". ",
      constraint: "Do not extrapolate assumptions beyond 90-day data",
      mid3: ", and ",
      output: "format findings as an executive markdown table followed by three action items",
      suffix: ".",
    },
    slots: {
      role: "SaaS growth intelligence and retention cohort analyst.",
      goal: "Analyze weekly customer cohort retention drops and conversion velocity.",
      constraint: "Do not extrapolate beyond validated 90-day telemetry. Ground numbers in raw counts.",
      output: "Executive summary table in Markdown followed by exactly 3 prioritized action items.",
    },
    vagueComparison: {
      badPrompt: "analyze our retention cohorts tell me what to do give me a table",
      risks: [
        "Hallucinates 12-month projections without underlying telemetry",
        "Omits sample size and churn confidence intervals",
        "Action items are generic platitudes rather than metric levers",
      ],
    },
  },
  {
    id: "sql-dba",
    name: "SQL Migration Engineer",
    category: "Database & Infrastructure",
    rawText:
      "Work as a Postgres database DBA that writes zero-downtime schema migrations for high-throughput tables. Avoid table-locking operations like unindexed foreign keys, and produce idempotent SQL with reversible down-migration scripts.",
    phrases: {
      prefix: "Work as a ",
      role: "Postgres database DBA",
      mid1: " that ",
      goal: "writes zero-downtime schema migrations for high-throughput tables",
      mid2: ". ",
      constraint: "Avoid table-locking operations like unindexed foreign keys",
      mid3: ", and ",
      output: "produce idempotent SQL with reversible down-migration scripts",
      suffix: ".",
    },
    slots: {
      role: "PostgreSQL Database Administrator specialized in high-concurrency systems.",
      goal: "Generate safe, zero-downtime schema migration plans for million-row tables.",
      constraint: "Zero exclusive table locks. Use concurrent indexes and staged backfills only.",
      output: "Idempotent forward SQL migration script paired with a verified rollback script.",
    },
    vagueComparison: {
      badPrompt: "write a migration for postgres table without downtime and give rollback",
      risks: [
        "Adds unindexed foreign key causing ACCESS EXCLUSIVE table lock",
        "Migration fails midway leaving schema in non-recoverable state",
        "Missing transactional safety and transaction statement bounds",
      ],
    },
  },
];

import {
  parseCustomSentence,
  segmentCustomInput,
  type ParsedSentenceResult,
  type TextSegment,
} from "./plainEnglishParser";

export {
  parseCustomSentence,
  segmentCustomInput,
  type ParsedSentenceResult,
  type TextSegment,
};

export function PlainEnglishShowcase({ onNavigate, onSelectPrompt }: PlainEnglishShowcaseProps) {
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Real-time typewriter engine
  const [typedCharCount, setTypedCharCount] = useState<number>(0);
  const [isTypingComplete, setIsTypingComplete] = useState<boolean>(false);
  const [typingSpeed, setTypingSpeed] = useState<1 | 2>(1);
  const [isTerminalCustomActive, setIsTerminalCustomActive] = useState<boolean>(false);
  const [terminalCustomText, setTerminalCustomText] = useState<string>("");

  // Scratchpad interactive state
  const [scratchpadInput, setScratchpadInput] = useState(
    "I need an expert Python tutor that teaches beginners recursion without confusing math jargon and keeps answers under 3 paragraphs."
  );
  const [isScratchpadActive, setIsScratchpadActive] = useState(false);

  const activePreset = PRESETS[activePresetIndex] || PRESETS[0];

  const parsedScratchpad = useMemo(() => {
    return parseCustomSentence(scratchpadInput);
  }, [scratchpadInput]);

  const customSegments = useMemo(() => {
    return segmentCustomInput(scratchpadInput, parsedScratchpad.phrases);
  }, [scratchpadInput, parsedScratchpad]);

  const parsedTerminalCustom = useMemo(() => {
    return parseCustomSentence(terminalCustomText);
  }, [terminalCustomText]);

  interface PresetSegment {
    text: string;
    type: "plain" | "role" | "goal" | "constraint" | "output";
  }

  const currentPresetSegments: PresetSegment[] = useMemo(() => {
    return [
      { text: activePreset.phrases.prefix || "", type: "plain" },
      { text: activePreset.phrases.role || "", type: "role" },
      { text: activePreset.phrases.mid1 || "", type: "plain" },
      { text: activePreset.phrases.goal || "", type: "goal" },
      { text: activePreset.phrases.mid2 || "", type: "plain" },
      { text: activePreset.phrases.constraint || "", type: "constraint" },
      { text: activePreset.phrases.mid3 || "", type: "plain" },
      { text: activePreset.phrases.output || "", type: "output" },
      { text: activePreset.phrases.suffix || "", type: "plain" },
    ];
  }, [activePreset]);

  const totalPresetChars = useMemo(() => {
    return currentPresetSegments.reduce((sum, s) => sum + s.text.length, 0);
  }, [currentPresetSegments]);

  const fullSentenceText = useMemo(() => {
    return currentPresetSegments.map((s) => s.text).join("");
  }, [currentPresetSegments]);

  // Reduced motion detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // Real-time progressive typewriter loop with realistic keystroke delays
  useEffect(() => {
    if (prefersReducedMotion) {
      setTypedCharCount(totalPresetChars);
      setIsTypingComplete(true);
      return;
    }
    if (!isPlaying || isHovered || isScratchpadActive || isTerminalCustomActive) {
      return;
    }

    if (typedCharCount >= totalPresetChars) {
      setIsTypingComplete(true);
      // Finished typing! Pause for 4.5 seconds to inspect, then cycle to next preset
      const pauseTimer = setTimeout(() => {
        setActivePresetIndex((prev) => (prev + 1) % PRESETS.length);
        setTypedCharCount(0);
        setIsTypingComplete(false);
      }, 4500);
      return () => clearTimeout(pauseTimer);
    }

    // Dynamic keystroke timing (natural pauses at punctuation and spaces)
    const nextChar = fullSentenceText[typedCharCount] || "";
    let baseDelay = typingSpeed === 2 ? 14 : 28;
    if (nextChar === "." || nextChar === "!") {
      baseDelay = typingSpeed === 2 ? 160 : 300;
    } else if (nextChar === ",") {
      baseDelay = typingSpeed === 2 ? 100 : 180;
    } else if (nextChar === " ") {
      baseDelay = typingSpeed === 2 ? 20 : 40;
    } else {
      baseDelay += (typedCharCount % 4) * (typingSpeed === 2 ? 2 : 4);
    }

    const timer = setTimeout(() => {
      setTypedCharCount((c) => Math.min(c + 1, totalPresetChars));
    }, baseDelay);

    return () => clearTimeout(timer);
  }, [
    typedCharCount,
    totalPresetChars,
    isPlaying,
    isHovered,
    isScratchpadActive,
    isTerminalCustomActive,
    prefersReducedMotion,
    fullSentenceText,
    typingSpeed,
  ]);

  // Synchronized rendered segments and slot activation
  const { renderedPresetSegments, slotStatus } = useMemo(() => {
    let remaining = prefersReducedMotion ? totalPresetChars : typedCharCount;
    const rendered = currentPresetSegments.map((seg) => {
      if (remaining <= 0) {
        return { ...seg, text: "", isComplete: false, isTyping: false };
      }
      if (remaining >= seg.text.length) {
        remaining -= seg.text.length;
        return { ...seg, text: seg.text, isComplete: true, isTyping: false };
      }
      const partial = seg.text.slice(0, remaining);
      remaining = 0;
      return { ...seg, text: partial, isComplete: false, isTyping: true };
    });

    const getStatus = (type: "role" | "goal" | "constraint" | "output") => {
      const s = rendered.find((r) => r.type === type);
      if (!s || s.text.length === 0) return "waiting";
      if (s.isComplete) return "complete";
      if (s.isTyping) return "typing";
      return "waiting";
    };

    return {
      renderedPresetSegments: rendered,
      slotStatus: {
        role: getStatus("role"),
        goal: getStatus("goal"),
        constraint: getStatus("constraint"),
        output: getStatus("output"),
      },
    };
  }, [currentPresetSegments, typedCharCount, totalPresetChars, prefersReducedMotion]);

  const handleSelectPreset = (idx: number) => {
    setIsScratchpadActive(false);
    setIsTerminalCustomActive(false);
    setActivePresetIndex(idx);
    setActiveStep(0);
    setTypedCharCount(0);
    setIsTypingComplete(false);
  };

  const scrubToSlot = (slotType: "role" | "goal" | "constraint" | "output") => {
    const step = slotType === "role" ? 0 : slotType === "goal" ? 1 : slotType === "constraint" ? 2 : 3;
    setActiveStep(step);
    let count = 0;
    for (const seg of currentPresetSegments) {
      count += seg.text.length;
      if (seg.type === slotType) break;
    }
    setTypedCharCount(count);
  };

  const handleReplayTyping = () => {
    setIsTerminalCustomActive(false);
    setTypedCharCount(0);
    setIsTypingComplete(false);
    setIsPlaying(true);
  };

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 3000);
  };

  const handleCopyPrompt = async () => {
    const isCustom = isScratchpadActive;
    const title = isCustom ? "Custom Decomposed Prompt" : activePreset.name;
    const slots = isCustom ? parsedScratchpad : activePreset.slots;

    const fullPrompt = [
      `# System Prompt: ${title}`,
      "",
      `## 1. Role`,
      slots.role,
      "",
      `## 2. Goal`,
      slots.goal,
      "",
      `## 3. Constraints`,
      slots.constraint,
      "",
      `## 4. Output Contract`,
      slots.output,
      "",
      `<!-- Compiled by System Prompt Engine (SPE WASM Core) -->`,
    ].join("\n");

    const ok = await copyTextSafe(fullPrompt);
    if (ok) {
      showToast(isCustom ? "✓ Copied custom system prompt!" : "✓ Copied verified system prompt!");
    }
  };

  const handleCopyCliCommand = async () => {
    const cmd = "npm install -g @systempromptengine/cli && spe continue -";
    const ok = await copyTextSafe(cmd);
    if (ok) showToast("✓ Copied CLI command to clipboard!");
  };

  const handleLoadCustomToStudio = () => {
    const compiled = [
      `Role: ${parsedScratchpad.role}`,
      `Goal: ${parsedScratchpad.goal}`,
      `Constraint: ${parsedScratchpad.constraint}`,
      `Output: ${parsedScratchpad.output}`,
    ].join("\n");

    if (onSelectPrompt) {
      onSelectPrompt(compiled);
    }
    const studioEl = document.getElementById("prompt-studio");
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: "smooth" });
    } else if (onNavigate) {
      onNavigate("create");
      window.scrollTo(0, 0);
    }
  };

  // Active display slots
  const displaySlots = isScratchpadActive
    ? parsedScratchpad
    : activePreset.slots;

  return (
    <section
      className="spe-plain-showcase"
      id="plain-english-showcase"
      aria-labelledby="plain-main-heading"
      data-copy-depth="PROOF"
    >
      {/* Toast Notification */}
      {copiedToast && (
        <div className="spe-plain-toast" role="status" aria-live="polite">
          {copiedToast}
        </div>
      )}

      {/* Top Kicker & Exactly One Main Heading */}
      <header className="spe-plain-header">
        <p className="spe-plain-kicker">SYSTEM PROMPT ENGINE</p>
        <h2 id="plain-main-heading" className="spe-plain-main-heading">
          Say it plainly.
          <br />
          Get a prompt that holds.
        </h2>
        <p className="spe-plain-subheading">
          Describe what you need in your own words. SPE structures it into role,
          goal, constraints and output format, right in your browser. Free, and no
          account.
        </p>
        <div className="spe-plain-header-actions">
          <a
            href="#plain-section-scratchpad"
            className="spe-plain-btn-primary"
            onClick={(e) => {
              const el = document.getElementById("plain-section-scratchpad");
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            Write your first prompt
          </a>
          <a
            href="#plain-section-compare"
            className="spe-plain-btn-secondary"
            onClick={(e) => {
              const el = document.getElementById("plain-section-compare");
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            See a before and after
          </a>
        </div>
      </header>

      {/* SECTION 1: Three steps from idea to instruction. */}
      <section
        className="spe-plain-sub-section"
        id="plain-section-steps"
        aria-labelledby="plain-heading-steps"
      >
        <h3 id="plain-heading-steps" className="spe-plain-section-title">
          Three steps from idea to instruction.
        </h3>
        <p className="spe-plain-section-lead">
          From unedited thoughts to mathematically bounded AI instructions in
          milliseconds.
        </p>

        {/* 3 Step Cards */}
        <div className="spe-plain-three-steps-grid">
          <div className="spe-step-card">
            <div className="spe-step-num">01</div>
            <div className="spe-step-body">
              <strong className="spe-step-name">Your Words First</strong>
              <p className="spe-step-desc">
                Type everyday speech. No prompt engineering tricks, jailbreak
                syntax, or XML boilerplates required.
              </p>
            </div>
          </div>
          <div className="spe-step-card">
            <div className="spe-step-num">02</div>
            <div className="spe-step-body">
              <strong className="spe-step-name">4-Slot Decomposition</strong>
              <p className="spe-step-desc">
                WASM engine classifies phrases into Role, Goal, Constraint, and
                Output Format with zero network calls.
              </p>
            </div>
          </div>
          <div className="spe-step-card">
            <div className="spe-step-num">03</div>
            <div className="spe-step-body">
              <strong className="spe-step-name">Take It Anywhere</strong>
              <p className="spe-step-desc">
                Deploy to Claude, ChatGPT, Cursor, local terminal pipelines, or
                CI/CD regression gates with cryptographic proof.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive macOS Terminal Window Centerpiece */}
        <div
          className="spe-plain-terminal-window"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* macOS Title Bar */}
          <div className="spe-plain-terminal-bar">
            <div className="spe-mac-dots" aria-hidden="true">
              <span className="spe-dot spe-dot-red" />
              <span className="spe-dot spe-dot-yellow" />
              <span className="spe-dot spe-dot-green" />
            </div>
            <div className="spe-mac-title">brief.txt → system-prompt.md</div>
            <div className="spe-mac-controls">
              <button
                type="button"
                className="spe-mac-btn"
                onClick={() => setTypingSpeed((s) => (s === 1 ? 2 : 1))}
                title="Toggle typing speed"
              >
                ⚡ {typingSpeed}x Speed
              </button>
              <button
                type="button"
                className="spe-mac-btn"
                aria-label="Replay typing"
                onClick={handleReplayTyping}
                title="Replay from start"
              >
                ↺ Replay
              </button>
              <button
                type="button"
                className="spe-mac-btn"
                aria-label={isPlaying ? "Pause animation" : "Play animation"}
                onClick={() => setIsPlaying((p) => !p)}
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
            </div>
          </div>

          {/* Preset Selector Bar */}
          <div
            className="spe-plain-presets-bar"
            role="tablist"
            aria-label="Preset showcases"
          >
            {PRESETS.map((preset, idx) => (
              <button
                key={preset.id}
                role="tab"
                id={`tab-${preset.id}`}
                aria-selected={!isScratchpadActive && !isTerminalCustomActive && activePresetIndex === idx}
                aria-controls="plain-pane-container"
                className={`spe-preset-chip ${
                  !isScratchpadActive && !isTerminalCustomActive && activePresetIndex === idx ? "active" : ""
                }`}
                onClick={() => handleSelectPreset(idx)}
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              className={`spe-preset-chip ${isTerminalCustomActive ? "active custom-chip" : ""}`}
              onClick={() => {
                setIsScratchpadActive(false);
                setIsTerminalCustomActive(true);
                if (!terminalCustomText) {
                  setTerminalCustomText(
                    "I need an AI support assistant for my SaaS app that handles billing questions, never issues refunds directly, and answers in under 3 sentences."
                  );
                }
              }}
            >
              ✍️ Type Your Own Here
            </button>
            {isScratchpadActive && (
              <span className="spe-preset-chip active custom-chip">
                ✍️ Live Scratchpad Active
              </span>
            )}
          </div>

          {/* Dual Pane Layout */}
          <div className="spe-plain-panes" id="plain-pane-container">
            {/* Left Pane: YOUR WORDS */}
            <div className="spe-plain-left-pane">
              <div className="spe-pane-header-row">
                <div className="spe-pane-label">YOUR WORDS</div>
                {isTerminalCustomActive ? (
                  <span className="spe-typing-status-pill">
                    ✍️ Interactive Input Active
                  </span>
                ) : isTypingComplete ? (
                  <span className="spe-typing-status-pill complete">
                    ✓ Prompt Complete
                  </span>
                ) : (
                  <span className="spe-typing-status-pill">
                    ● Typing in Real-Time...
                  </span>
                )}
              </div>

              <div className="spe-words-content" tabIndex={0}>
                {isTerminalCustomActive ? (
                  <textarea
                    className="spe-terminal-textarea"
                    value={terminalCustomText}
                    placeholder="Type any plain-English prompt here: e.g. I need an AI support engineer for my app..."
                    onChange={(e) => setTerminalCustomText(e.target.value)}
                    autoFocus
                  />
                ) : isScratchpadActive ? (
                  <p className="spe-words-paragraph">
                    {customSegments.map((seg, idx) => {
                      if (seg.type === "plain") {
                        return <span key={idx}>{seg.text}</span>;
                      }
                      return (
                        <span
                          key={idx}
                          className={`spe-phrase-pill spe-pill-${seg.type} highlight`}
                        >
                          {seg.text}
                        </span>
                      );
                    })}
                    <span className="spe-cursor" aria-hidden="true">
                      |
                    </span>
                  </p>
                ) : (
                  <p className="spe-words-paragraph">
                    {renderedPresetSegments.map((seg, idx) => {
                      if (!seg.text) return null;
                      if (seg.type === "plain") {
                        return <span key={idx}>{seg.text}</span>;
                      }
                      return (
                        <span
                          key={idx}
                          className={`spe-phrase-pill spe-pill-${seg.type} highlight ${
                            seg.isTyping ? "typing-pill" : ""
                          } ${seg.isComplete ? "complete-pill" : ""}`}
                        >
                          {seg.text}
                        </span>
                      );
                    })}
                    <span className="spe-cursor" aria-hidden="true">
                      |
                    </span>
                  </p>
                )}
              </div>

              <div className="spe-words-footer">
                <span className="spe-words-hint">
                  🟢 Role · 🔵 Goal · 🟠 Constraint · 🟣 Output
                </span>
                <div className="spe-words-actions">
                  {!isTerminalCustomActive && (
                    <button
                      type="button"
                      className="spe-pill-action"
                      onClick={handleReplayTyping}
                      title="Replay typing animation"
                    >
                      ↺ Replay
                    </button>
                  )}
                  <button
                    type="button"
                    className="spe-pill-action"
                    onClick={handleCopyPrompt}
                  >
                    Copy Prompt
                  </button>
                </div>
              </div>
            </div>

            {/* Right Pane: STRUCTURED PROMPT */}
            <div className="spe-plain-right-pane">
              <div className="spe-pane-label">STRUCTURED PROMPT</div>
              <div className="spe-slots-container">
                {/* 1. ROLE */}
                <div
                  className={`spe-slot-card spe-slot-role ${
                    activeStep === 0 || slotStatus.role !== "waiting" ? "active" : ""
                  } ${slotStatus.role === "typing" ? "is-typing" : ""} ${
                    slotStatus.role === "complete" ? "is-complete" : ""
                  }`}
                  onClick={() => scrubToSlot("role")}
                >
                  <div className="spe-slot-badge-row">
                    <span className="spe-slot-badge spe-badge-role">ROLE</span>
                    {slotStatus.role === "typing" && (
                      <span className="spe-slot-status-indicator typing">● Typing phrase...</span>
                    )}
                    {slotStatus.role === "complete" && (
                      <span className="spe-slot-status-indicator complete">✓ Extracted</span>
                    )}
                    {slotStatus.role === "waiting" && (
                      <span className="spe-slot-status-indicator waiting">Waiting...</span>
                    )}
                  </div>
                  <div className="spe-slot-text">
                    {slotStatus.role === "waiting" ? (
                      <span className="spe-slot-placeholder">Awaiting role in prompt...</span>
                    ) : (
                      isTerminalCustomActive ? parsedTerminalCustom.role : displaySlots.role
                    )}
                  </div>
                </div>

                {/* 2. GOAL */}
                <div
                  className={`spe-slot-card spe-slot-goal ${
                    activeStep === 1 || slotStatus.goal !== "waiting" ? "active" : ""
                  } ${slotStatus.goal === "typing" ? "is-typing" : ""} ${
                    slotStatus.goal === "complete" ? "is-complete" : ""
                  }`}
                  onClick={() => scrubToSlot("goal")}
                >
                  <div className="spe-slot-badge-row">
                    <span className="spe-slot-badge spe-badge-goal">GOAL</span>
                    {slotStatus.goal === "typing" && (
                      <span className="spe-slot-status-indicator typing">● Typing phrase...</span>
                    )}
                    {slotStatus.goal === "complete" && (
                      <span className="spe-slot-status-indicator complete">✓ Extracted</span>
                    )}
                    {slotStatus.goal === "waiting" && (
                      <span className="spe-slot-status-indicator waiting">Waiting...</span>
                    )}
                  </div>
                  <div className="spe-slot-text">
                    {slotStatus.goal === "waiting" ? (
                      <span className="spe-slot-placeholder">Awaiting goal in prompt...</span>
                    ) : (
                      isTerminalCustomActive ? parsedTerminalCustom.goal : displaySlots.goal
                    )}
                  </div>
                </div>

                {/* 3. CONSTRAINT */}
                <div
                  className={`spe-slot-card spe-slot-constraint ${
                    activeStep === 2 || slotStatus.constraint !== "waiting" ? "active" : ""
                  } ${slotStatus.constraint === "typing" ? "is-typing" : ""} ${
                    slotStatus.constraint === "complete" ? "is-complete" : ""
                  }`}
                  onClick={() => scrubToSlot("constraint")}
                >
                  <div className="spe-slot-badge-row">
                    <span className="spe-slot-badge spe-badge-constraint">CONSTRAINT</span>
                    {slotStatus.constraint === "typing" && (
                      <span className="spe-slot-status-indicator typing">● Typing phrase...</span>
                    )}
                    {slotStatus.constraint === "complete" && (
                      <span className="spe-slot-status-indicator complete">✓ Extracted</span>
                    )}
                    {slotStatus.constraint === "waiting" && (
                      <span className="spe-slot-status-indicator waiting">Waiting...</span>
                    )}
                  </div>
                  <div className="spe-slot-text">
                    {slotStatus.constraint === "waiting" ? (
                      <span className="spe-slot-placeholder">Awaiting constraint in prompt...</span>
                    ) : (
                      isTerminalCustomActive ? parsedTerminalCustom.constraint : displaySlots.constraint
                    )}
                  </div>
                </div>

                {/* 4. OUTPUT */}
                <div
                  className={`spe-slot-card spe-slot-output ${
                    activeStep === 3 || slotStatus.output !== "waiting" ? "active" : ""
                  } ${slotStatus.output === "typing" ? "is-typing" : ""} ${
                    slotStatus.output === "complete" ? "is-complete" : ""
                  }`}
                  onClick={() => scrubToSlot("output")}
                >
                  <div className="spe-slot-badge-row">
                    <span className="spe-slot-badge spe-badge-output">OUTPUT</span>
                    {slotStatus.output === "typing" && (
                      <span className="spe-slot-status-indicator typing">● Typing phrase...</span>
                    )}
                    {slotStatus.output === "complete" && (
                      <span className="spe-slot-status-indicator complete">✓ Extracted</span>
                    )}
                    {slotStatus.output === "waiting" && (
                      <span className="spe-slot-status-indicator waiting">Waiting...</span>
                    )}
                  </div>
                  <div className="spe-slot-text">
                    {slotStatus.output === "waiting" ? (
                      <span className="spe-slot-placeholder">Awaiting output format in prompt...</span>
                    ) : (
                      isTerminalCustomActive ? parsedTerminalCustom.output : displaySlots.output
                    )}
                  </div>
                </div>
              </div>

              <div className="spe-slots-footer">
                <span className="spe-slots-integrity">
                  {isTypingComplete
                    ? "✓ 4/4 Invariants Extracted & Sealed · WASM Core"
                    : "⚡ Real-Time Phrase Extraction · Kleene-3 AST"}
                </span>
                <button
                  type="button"
                  className="spe-pill-action-bright"
                  onClick={handleCopyPrompt}
                >
                  Export System Prompt →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Same request. Clearer instructions. */}
      <section
        className="spe-plain-sub-section"
        id="plain-section-compare"
        aria-labelledby="plain-heading-compare"
      >
        <h3 id="plain-heading-compare" className="spe-plain-section-title">
          Same request. Clearer instructions.
        </h3>
        <p className="spe-plain-section-lead">
          How small ambiguities in informal prompts explode into hallucinations,
          and how SPE locks down exact requirements.
        </p>

        <div className="spe-compare-container">
          <div className="spe-compare-grid">
            {/* Left: Vague Prompt */}
            <div className="spe-compare-column spe-compare-vague">
              <div className="spe-compare-badge vague-badge">
                ⚠️ Vague One-Liner (Unbounded)
              </div>
              <blockquote className="spe-vague-quote">
                &ldquo;{activePreset.vagueComparison.badPrompt}&rdquo;
              </blockquote>
              <div className="spe-risks-list">
                <p className="spe-risks-title">Failure Modes in Production:</p>
                <ul>
                  {activePreset.vagueComparison.risks.map((risk, i) => (
                    <li key={i}>❌ {risk}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Structured Prompt */}
            <div className="spe-compare-column spe-compare-structured">
              <div className="spe-compare-badge structured-badge">
                🛡️ SPE Invariant Sealed (ProtectedIntent)
              </div>
              <div className="spe-structured-preview">
                <div className="spe-spec-line">
                  <span className="spe-badge-role">ROLE</span>
                  <span>{displaySlots.role}</span>
                </div>
                <div className="spe-spec-line">
                  <span className="spe-badge-goal">GOAL</span>
                  <span>{displaySlots.goal}</span>
                </div>
                <div className="spe-spec-line">
                  <span className="spe-badge-constraint">CONSTRAINT</span>
                  <span>{displaySlots.constraint}</span>
                </div>
                <div className="spe-spec-line">
                  <span className="spe-badge-output">OUTPUT</span>
                  <span>{displaySlots.output}</span>
                </div>
              </div>
              <div className="spe-compare-footer">
                <span>0 Ambiguity · RFC 8785 Hash Bound</span>
                <button
                  type="button"
                  className="spe-btn-load"
                  onClick={() => {
                    setIsScratchpadActive(false);
                    const el = document.getElementById("plain-pane-container");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Inspect in Visual Window ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Your words stay on your device. */}
      <section
        className="spe-plain-sub-section"
        id="plain-section-device"
        aria-labelledby="plain-heading-device"
      >
        <h3 id="plain-heading-device" className="spe-plain-section-title">
          Your words stay on your device.
        </h3>
        <p className="spe-plain-section-lead">
          Zero telemetry. No cloud training on your intellectual property. 100%
          local WebAssembly execution.
        </p>

        <div className="spe-device-pillars-grid">
          <div className="spe-pillar-card">
            <div className="spe-pillar-icon" aria-hidden="true">
              ⚡
            </div>
            <strong className="spe-pillar-title">1.3 MB WASM Engine</strong>
            <p className="spe-pillar-text">
              AST parsing, Kleene-3 logic compilation, and invariant checks run
              entirely inside your browser thread via Rust WebAssembly.
            </p>
            <span className="spe-pillar-chip">Privacy Ready</span>
          </div>

          <div className="spe-pillar-card">
            <div className="spe-pillar-icon" aria-hidden="true">
              🔒
            </div>
            <strong className="spe-pillar-title">0 Remote Bytes Sent</strong>
            <p className="spe-pillar-text">
              Turn off your Wi-Fi or inspect devtools network tabs. Not a single
              token of your prompts leaves your computer.
            </p>
            <span className="spe-pillar-chip">Air-Gapped Trust</span>
          </div>

          <div className="spe-pillar-card">
            <div className="spe-pillar-icon" aria-hidden="true">
              🔏
            </div>
            <strong className="spe-pillar-title">Deterministic Receipts</strong>
            <p className="spe-pillar-text">
              Every compiled prompt outputs an RFC 8785 canonical hash and Ed25519
              signature ready for git commits and security audits.
            </p>
            <span className="spe-pillar-chip">Audit Verified</span>
          </div>
        </div>
      </section>

      {/* SECTION 4: Made for the prompts you actually write. */}
      <section
        className="spe-plain-sub-section"
        id="plain-section-categories"
        aria-labelledby="plain-heading-categories"
      >
        <h3 id="plain-heading-categories" className="spe-plain-section-title">
          Made for the prompts you actually write.
        </h3>
        <p className="spe-plain-section-lead">
          Designed for high-leverage workflows where ambiguous prompts cost time,
          money, and engineering sanity.
        </p>

        <div className="spe-categories-grid">
          <div className="spe-cat-card">
            <div className="spe-cat-top">
              <span className="spe-cat-tag">Customer Support</span>
              <span className="spe-cat-count">100+ Guardrails</span>
            </div>
            <strong className="spe-cat-name">Customer Experience & Support</strong>
            <p className="spe-cat-desc">
              Locks strict boundary rules preventing unauthorized discount
              promises, refund commitments, and policy hallucination.
            </p>
            <button
              type="button"
              className="spe-cat-btn"
              onClick={() => {
                setIsScratchpadActive(false);
                setActivePresetIndex(0);
                setActiveStep(0);
                const el = document.getElementById("plain-pane-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Load Example in Window
            </button>
          </div>

          <div className="spe-cat-card">
            <div className="spe-cat-top">
              <span className="spe-cat-tag">Software Engineering</span>
              <span className="spe-cat-count">Invariant Sealed</span>
            </div>
            <strong className="spe-cat-name">Code Refactoring & DevOps</strong>
            <p className="spe-cat-desc">
              Forbids breaking existing API signatures, skipping unit tests, or
              modifying sensitive production config files.
            </p>
            <button
              type="button"
              className="spe-cat-btn"
              onClick={() => {
                setIsScratchpadActive(false);
                setActivePresetIndex(1);
                setActiveStep(0);
                const el = document.getElementById("plain-pane-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Load Example in Window
            </button>
          </div>

          <div className="spe-cat-card">
            <div className="spe-cat-top">
              <span className="spe-cat-tag">Data Intelligence</span>
              <span className="spe-cat-count">Grounded Data</span>
            </div>
            <strong className="spe-cat-name">Growth, Cohorts & Financials</strong>
            <p className="spe-cat-desc">
              Restricts models from guessing beyond validated 90-day telemetry,
              demanding raw counts and bounded intervals.
            </p>
            <button
              type="button"
              className="spe-cat-btn"
              onClick={() => {
                setIsScratchpadActive(false);
                setActivePresetIndex(2);
                setActiveStep(0);
                const el = document.getElementById("plain-pane-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Load Example in Window
            </button>
          </div>

          <div className="spe-cat-card">
            <div className="spe-cat-top">
              <span className="spe-cat-tag">DBA & Schema</span>
              <span className="spe-cat-count">Zero-Downtime</span>
            </div>
            <strong className="spe-cat-name">Database Migrations & SQL</strong>
            <p className="spe-cat-desc">
              Blocks ACCESS EXCLUSIVE locks, ensures concurrent index builds,
              and generates reversible rollback migrations.
            </p>
            <button
              type="button"
              className="spe-cat-btn"
              onClick={() => {
                setIsScratchpadActive(false);
                setActivePresetIndex(3);
                setActiveStep(0);
                const el = document.getElementById("plain-pane-container");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Load Example in Window
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 5: Start with one sentence. */}
      <section
        className="spe-plain-sub-section"
        id="plain-section-scratchpad"
        aria-labelledby="plain-heading-scratchpad"
      >
        <h3 id="plain-heading-scratchpad" className="spe-plain-section-title">
          Start with one sentence.
        </h3>
        <p className="spe-plain-section-lead">
          Test it right here. Type or paste any prompt thought below — watch it
          decompose into Role, Goal, Constraint, and Output slots live.
        </p>

        <div className="spe-scratchpad-card">
          <div className="spe-scratchpad-header">
            <label htmlFor="spe-scratchpad-textarea" className="spe-scratchpad-title">
              LIVE INTERACTIVE SCRATCHPAD
            </label>
            <span className="spe-scratchpad-sub">
              Real-time AST parsing in browser
            </span>
          </div>

          <textarea
            id="spe-scratchpad-textarea"
            className="spe-scratchpad-textarea"
            rows={3}
            value={scratchpadInput}
            placeholder="Type any instruction: e.g. I need a PR reviewer for Next.js that spots memory leaks, never rewrites working code, and comments only in unified diffs."
            onChange={(e) => {
              setScratchpadInput(e.target.value);
              setIsScratchpadActive(true);
            }}
            onFocus={() => setIsScratchpadActive(true)}
          />

          {/* Quick Starters */}
          <div className="spe-scratchpad-starters">
            <span className="spe-starter-lead">Try quick ideas:</span>
            <button
              type="button"
              className="spe-starter-btn"
              onClick={() => {
                setScratchpadInput(
                  "I need an expert Python tutor that teaches beginners recursion without confusing math jargon and keeps answers under 3 paragraphs."
                );
                setIsScratchpadActive(true);
              }}
            >
              Python Tutor
            </button>
            <button
              type="button"
              className="spe-starter-btn"
              onClick={() => {
                setScratchpadInput(
                  "Act as an iOS Swift engineer that audits memory retain cycles. Never suggest unsafe force-unwrapping, and list fixes as bullet points with code snippets."
                );
                setIsScratchpadActive(true);
              }}
            >
              Swift Auditor
            </button>
            <button
              type="button"
              className="spe-starter-btn"
              onClick={() => {
                setScratchpadInput(
                  "Work as a marketing copywriter that writes punchy hero headlines for developer tools. Avoid buzzwords like revolutionize, and provide 5 variations under 8 words each."
                );
                setIsScratchpadActive(true);
              }}
            >
              Dev Headline Writer
            </button>
          </div>

          {/* Live Extracted Slots */}
          <div className="spe-scratchpad-results">
            <div className="spe-res-slot res-role">
              <span className="spe-res-tag tag-role">🟢 ROLE</span>
              <p className="spe-res-val">{parsedScratchpad.role}</p>
            </div>
            <div className="spe-res-slot res-goal">
              <span className="spe-res-tag tag-goal">🔵 GOAL</span>
              <p className="spe-res-val">{parsedScratchpad.goal}</p>
            </div>
            <div className="spe-res-slot res-constraint">
              <span className="spe-res-tag tag-constraint">🟠 CONSTRAINT</span>
              <p className="spe-res-val">{parsedScratchpad.constraint}</p>
            </div>
            <div className="spe-res-slot res-output">
              <span className="spe-res-tag tag-output">🟣 OUTPUT</span>
              <p className="spe-res-val">{parsedScratchpad.output}</p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="spe-scratchpad-actions">
            <button
              type="button"
              className="spe-act-btn-main"
              onClick={handleLoadCustomToStudio}
            >
              Open in SPE Full Studio ↗
            </button>
            <button
              type="button"
              className="spe-act-btn-copy"
              onClick={async () => {
                const text = [
                  `# System Prompt: Custom Decomposed Prompt`,
                  "",
                  `## 1. Role`,
                  parsedScratchpad.role,
                  "",
                  `## 2. Goal`,
                  parsedScratchpad.goal,
                  "",
                  `## 3. Constraints`,
                  parsedScratchpad.constraint,
                  "",
                  `## 4. Output Contract`,
                  parsedScratchpad.output,
                  "",
                  `<!-- Compiled by System Prompt Engine (SPE WASM Core) -->`,
                ].join("\n");
                const ok = await copyTextSafe(text);
                if (ok) showToast("✓ Copied custom system prompt!");
              }}
            >
              Copy Structured Prompt
            </button>
            <button
              type="button"
              className="spe-act-btn-cli"
              onClick={handleCopyCliCommand}
            >
              Copy CLI Pipe ($ spe continue -)
            </button>
          </div>

          {/* Developer Pro & Paid Member Conversion Banner */}
          <div className="spe-pro-conversion-banner">
            <div className="spe-pro-banner-left">
              <div className="spe-pro-badge">
                DEVELOPER PRO &amp; CI/CD GATE · $9 INTRO
              </div>
              <strong className="spe-pro-title">
                Automate Prompt Invariants Across Your Entire Engineering Team
              </strong>
              <p className="spe-pro-desc">
                Catch regressions before merge. Includes <code>spe check --pre-commit</code>,
                Ed25519 tamper-proof receipts, 100k+ token AST compilation, and
                unlimited local CLI runs.
              </p>
            </div>
            <div className="spe-pro-banner-right">
              <button
                type="button"
                className="spe-pro-cta-btn"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate("pricing");
                    window.scrollTo(0, 0);
                  }
                }}
              >
                Explore Developer Pro ($9/mo) →
              </button>
              <span className="spe-pro-subtext">
                Free Community version is $0 forever.
              </span>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
