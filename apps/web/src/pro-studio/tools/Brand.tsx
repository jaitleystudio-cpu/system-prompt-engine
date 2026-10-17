import { useState } from "react";
import { usePro, usePersisted } from "../context.ts";
import { ToolFrame, Field, commaList } from "./Frame.tsx";
import { type BrandGuide, EMPTY_GUIDE, lintBrand, guideToBlock, applyReplacements } from "../core/brandGuide.ts";
import { assemble, uid } from "../core/studio.ts";
const KEY = "spe.pro.studio.v2.brand";
const isGuide = (v: unknown): v is BrandGuide => !!v && typeof v === "object" && Array.isArray((v as BrandGuide).required) && Array.isArray((v as BrandGuide).replace);
export default function Brand() {
  const { active, updateSession, announce, log } = usePro();
  const [g, setG] = usePersisted<BrandGuide>(KEY, () => ({ ...EMPTY_GUIDE, name: "Northwind", voice: "Warm, plain English, no hype.", required: ["Northwind Cloud"], banned: ["revolutionary", "guaranteed"], replace: [{ from: "utilize", to: "use" }], maxSentenceWords: 25 }), isGuide);
  const [free, setFree] = useState("");
  const text = free.trim() ? free : active ? assemble(active.blocks) : "";
  const fs = lintBrand(text, g); const block = guideToBlock(g);
  const panel = (<div className="ps-stack" data-testid="brand-out">
    <p className="ps-hint">Checking: {free.trim() ? "the text you pasted" : active ? "the current session" : "nothing yet"}. Exact word matching only; it does not judge tone.</p>
    <ul className="ps-checks">{fs.length ? fs.map((f, i) => <li key={i} className={`ps-q ps-q--${f.level}`}><i aria-hidden="true">{f.level === "ok" ? "✓" : f.level === "bad" ? "×" : "!"}</i><div><b><span className="sr-only">{f.level === "ok" ? "Pass: " : f.level === "bad" ? "Fail: " : "Warning: "}</span>{f.message}</b></div></li>) : <li className="ps-hint">Add rules to the guide to check text.</li>}</ul>
    <h3 className="ps-h3">Guide as a prompt block</h3><pre className="ps-pre ps-pre--sm">{block.text || "(empty guide)"}</pre>
    {active && <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" disabled={!block.text} onClick={() => { updateSession(active.id, (s) => ({ ...s, blocks: [...s.blocks, { ...block, id: uid() }] })); announce("Brand voice block added to the session"); log("brand.insert", g.name); }}>Add block to session</button>
      <button type="button" className="ps-btn ps-btn--sm" disabled={!g.replace.length} onClick={() => { updateSession(active.id, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.kind === "requirements" ? b : { ...b, text: applyReplacements(b.text, g) })) })); announce("Replacements applied to the session"); log("brand.replace", g.name); }}>Apply replacements to session</button></div>}
  </div>);
  return (
    <ToolFrame id="brand" panel={panel} panelLabel="Findings">
      <div className="ps-cols"><Field label="Brand name" id="br-name"><input id="br-name" className="ps-inp" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} /></Field>
        <Field label="Max words per sentence (blank = off)" id="br-max"><input id="br-max" className="ps-inp" type="number" min={1} value={g.maxSentenceWords ?? ""} onChange={(e) => setG({ ...g, maxSentenceWords: parseInt(e.target.value, 10) > 0 ? parseInt(e.target.value, 10) : null })} /></Field></div>
      <Field label="Voice" id="br-voice"><input id="br-voice" className="ps-inp" value={g.voice} onChange={(e) => setG({ ...g, voice: e.target.value })} /></Field>
      <div className="ps-cols"><Field label="Required terms (comma separated)" id="br-req"><input id="br-req" className="ps-inp" defaultValue={g.required.join(", ")} onBlur={(e) => setG({ ...g, required: commaList(e.target.value) })} /></Field>
        <Field label="Banned terms (comma separated)" id="br-ban"><input id="br-ban" className="ps-inp" defaultValue={g.banned.join(", ")} onBlur={(e) => setG({ ...g, banned: commaList(e.target.value) })} /></Field></div>
      <Field label="Replacements, one per line as: wrong => right" id="br-rep"><textarea id="br-rep" className="ps-ta" rows={3} defaultValue={g.replace.map((r) => `${r.from} => ${r.to}`).join("\n")} onBlur={(e) => setG({ ...g, replace: e.target.value.split("\n").map((l) => l.split("=>")).filter((p) => p.length === 2 && p[0].trim() && p[1].trim()).map(([a, b]) => ({ from: a.trim(), to: b.trim() })) })} /></Field>
      <Field label="Text to check (optional — leave empty to check the current session)" id="br-free"><textarea id="br-free" className="ps-ta" rows={4} value={free} onChange={(e) => setFree(e.target.value)} /></Field>
    </ToolFrame>
  );
}
