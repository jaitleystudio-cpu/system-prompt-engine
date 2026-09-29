/**
 * Qualification for a real repaired Create observation.
 * Receipt text is not evidence. Production code does not import this file.
 */

export function dropOneHardConstraint(prompt) {
  if (typeof prompt !== "string") return null;
  const marker = "## Hard constraints\n";
  const start = prompt.indexOf(marker);
  if (start < 0) return null;
  const bodyStart = start + marker.length;
  const end = prompt.indexOf("\n\n", bodyStart);
  const body = end < 0 ? prompt.slice(bodyStart) : prompt.slice(bodyStart, end);
  const lines = body.split("\n");
  const index = lines.findIndex((line) => line.startsWith("- "));
  if (index < 0) return null;
  const removed = lines[index].slice(2);
  const keptLines = lines.filter((_, lineIndex) => lineIndex !== index);
  const nextBody = keptLines.length > 0 ? keptLines.join("\n") : "none";
  const corrupted =
    prompt.slice(0, bodyStart) + nextBody + (end < 0 ? "" : prompt.slice(end));
  if (corrupted === prompt || corrupted.includes(`- ${removed}`)) return null;
  return { corrupted, removed };
}

function sections(prompt) {
  if (typeof prompt !== "string" || !prompt.startsWith("## ")) return null;
  const map = new Map();
  for (const chunk of prompt.split("\n\n")) {
    if (!chunk.startsWith("## ")) return null;
    const newline = chunk.indexOf("\n");
    const heading = newline < 0 ? chunk.slice(3) : chunk.slice(3, newline);
    const body = newline < 0 ? "" : chunk.slice(newline + 1);
    map.set(heading, body);
  }
  return map;
}

export function onlyDiagnosedConstraintRestored(corrupted, repaired, removed) {
  const before = sections(corrupted);
  const after = sections(repaired);
  if (!before || !after || !removed) return false;
  const headings = new Set([...before.keys(), ...after.keys()]);
  for (const heading of headings) {
    if (heading === "Hard constraints") continue;
    if (before.get(heading) !== after.get(heading)) return false;
  }
  const hard = after.get("Hard constraints") || "";
  return hard.split("\n").includes(`- ${removed}`) && !(before.get("Hard constraints") || "").split("\n").includes(`- ${removed}`);
}

export function qualifyRepairedBrowserObservation(obs) {
  const errors = [];
  const reconstruction = obs && obs.reconstruction;
  const plan = reconstruction && reconstruction.plan;
  const delta = reconstruction && reconstruction.quality_delta;
  const kept = reconstruction && reconstruction.kept_subject && reconstruction.kept_subject.compiled_prompt;
  const receipt = obs && obs.receipt;
  if (!obs || obs.qualityPosts !== 1) errors.push("F2-09");
  if (!plan || plan.attempt_index > 1 || plan.max_attempts !== 1) errors.push("F2-09");
  if (!reconstruction || reconstruction.kept !== "repaired") errors.push("kept");
  if (!plan || plan.disposition !== "ACCEPTED") errors.push("plan");
  if (!delta || delta.disposition !== "IMPROVED") errors.push("delta");
  if (!delta || !Array.isArray(delta.protected_regressions) || delta.protected_regressions.length !== 0) {
    errors.push("regressions");
  }
  if (!receipt || receipt.verdict !== "PASS") errors.push("verdict");
  if (typeof kept !== "string" || kept.length === 0) errors.push("kept_prompt");
  if (obs.canonical === obs.corrupted) errors.push("no_fault");
  if (obs.visible !== kept) errors.push("F2-01");
  if (obs.visible === obs.corrupted) errors.push("F2-03");
  if (obs.artifact !== kept) errors.push("F2-04");
  if (obs.history !== kept) errors.push("F2-05");
  if (obs.copy !== kept) errors.push("F2-06");
  if (obs.json !== kept) errors.push("F2-07");
  if (obs.spe !== kept) errors.push("F2-08");
  if (!onlyDiagnosedConstraintRestored(obs.corrupted, kept, obs.removed)) errors.push("F2-10");
  return { pass: errors.length === 0, errors };
}

function perfectObservation() {
  const canonical = "## Objective\nShip the note\n\n## Hard constraints\n- Do not invent facts\n\n## Facts\nnone";
  const fault = dropOneHardConstraint(canonical);
  const repaired = canonical;
  return {
    canonical,
    corrupted: fault.corrupted,
    removed: fault.removed,
    qualityPosts: 1,
    reconstruction: {
      kept: "repaired",
      kept_subject: { compiled_prompt: repaired },
      plan: { disposition: "ACCEPTED", attempt_index: 1, max_attempts: 1 },
      quality_delta: { disposition: "IMPROVED", protected_regressions: [] },
    },
    receipt: { verdict: "PASS" },
    visible: repaired,
    artifact: repaired,
    history: repaired,
    copy: repaired,
    json: repaired,
    spe: repaired,
    receiptText: "IMPROVED",
  };
}

export function killedRepairedBrowserMutants() {
  const base = perfectObservation();
  const control = qualifyRepairedBrowserObservation(base);
  if (!control.pass) {
    throw new Error(`control observation failed: ${control.errors.join(",")}`);
  }
  const killed = [];
  const ignored = { ...base, visible: base.canonical === base.visible ? base.corrupted : base.canonical };
  if (!qualifyRepairedBrowserObservation(ignored).pass) killed.push("F2-01");
  const receiptOnly = (obs) => String(obs.receiptText || "").includes("IMPROVED");
  const stale = { ...base, visible: base.corrupted, artifact: base.corrupted, history: base.corrupted, copy: base.corrupted, json: base.corrupted, spe: base.corrupted };
  if (receiptOnly(stale) && !qualifyRepairedBrowserObservation(stale).pass) killed.push("F2-02");
  if (!qualifyRepairedBrowserObservation({ ...base, visible: base.corrupted }).pass) killed.push("F2-03");
  if (!qualifyRepairedBrowserObservation({ ...base, artifact: base.corrupted }).pass) killed.push("F2-04");
  if (!qualifyRepairedBrowserObservation({ ...base, history: base.corrupted }).pass) killed.push("F2-05");
  if (!qualifyRepairedBrowserObservation({ ...base, copy: base.corrupted }).pass) killed.push("F2-06");
  if (!qualifyRepairedBrowserObservation({ ...base, json: base.corrupted }).pass) killed.push("F2-07");
  if (!qualifyRepairedBrowserObservation({ ...base, spe: base.corrupted }).pass) killed.push("F2-08");
  if (!qualifyRepairedBrowserObservation({ ...base, qualityPosts: 2 }).pass) killed.push("F2-09");
  if (!qualifyRepairedBrowserObservation({ ...base, visible: base.corrupted }).pass) killed.push("F3-11");
  if (!qualifyRepairedBrowserObservation({ ...base, json: base.corrupted, spe: base.corrupted }).pass) killed.push("F3-12");
  const drifted = base.visible.replace("## Objective\nShip the note", "## Objective\nOther goal");
  if (!qualifyRepairedBrowserObservation({
    ...base,
    reconstruction: {
      ...base.reconstruction,
      kept_subject: { compiled_prompt: drifted },
    },
    visible: drifted,
    artifact: drifted,
    history: drifted,
    copy: drifted,
    json: drifted,
    spe: drifted,
  }).pass) killed.push("F2-10");
  return killed;
}
