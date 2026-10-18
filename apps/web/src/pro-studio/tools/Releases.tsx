import { useState } from "react";
import { usePro, useProAction, download, copyText } from "../context.ts";
import { ToolFrame, Field, About } from "./Frame.tsx";
import { SEMVER } from "../shared/constants.ts";
import { sessionTitle, plainBlocks } from "../shared/workspace.ts";
import { proApi, ApiError } from "../api.ts";
import type { ReleasePack, VerifyResult } from "../core/releases.ts";
let history: ReleasePack[] = [];
type Verdict = { ok: boolean; title: string; items: string[] };
export default function Releases() {
  const { announce, active } = usePro();
  const [hist, setHist0] = useState<ReleasePack[]>(history); const setHist = (h: ReleasePack[]) => { history = h; setHist0(h); };
  const [f, setF] = useState({ name: active ? sessionTitle(active) : "Support assistant", version: "1.0.0", changelog: "First release.", prompt: "" });
  const [last, setLast] = useState<{ pack: ReleasePack; fp: string } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [vp, setVp] = useState(""); const [vf, setVf] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [cert, setCert] = useState(""); const [certV, setCertV] = useState<Verdict | null>(null);
  useProAction((id) => { if (id === "sign") document.getElementById("rel-name")?.focus(); if (id === "verify") document.getElementById("rel-vp")?.focus(); });
  const runVerify = async (text = vp) => { try { const r = await proApi<VerifyResult>("/releases/verify", { pack: text, fingerprint: vf }); setVerdict(r.ok ? { ok: true, title: "Valid. The pack is unchanged since it was signed.", items: [`Signed by key ${r.fingerprint}.`, vf.trim() ? "Matches the fingerprint you expected." : "Add the expected fingerprint to confirm who signed it."] } : { ok: false, title: "Not valid.", items: r.reasons }); } catch (e) { setVerdict({ ok: false, title: "Could not verify.", items: [(e as Error).message] }); } };
  const verifyCert = async () => { let c: unknown; try { c = JSON.parse(cert); } catch { setCertV({ ok: false, title: "Not valid JSON.", items: [] }); return; }
    try { const r = await proApi<{ ok: boolean; reasons: string[] }>("/certificate/verify", { certificate: c }); setCertV({ ok: r.ok, title: r.ok ? "Certificate checks out: the checks were re-run on the stored outputs and agree." : "Certificate does not check out.", items: r.reasons }); } catch (e) { setCertV({ ok: false, title: "Could not verify.", items: [(e as Error).message] }); } };
  const panel = (<div className="ps-stack">
    {last ? <><p className="ps-hint">Key fingerprint <code>{last.fp}</code> · sha256 <code>{last.pack.sha256.slice(0, 16)}…</code></p><pre className="ps-pre ps-pre--sm" tabIndex={0} aria-label="Signed release pack">{JSON.stringify(last.pack, null, 2)}</pre>
      <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(JSON.stringify(last.pack, null, 2))) ? "Pack copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => download(`${last.pack.name.replace(/\W+/g, "-").toLowerCase()}-${last.pack.version}.spe-release.json`, JSON.stringify(last.pack, null, 2))}>Download</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { const t = JSON.stringify(last.pack, null, 2); setVp(t); void runVerify(t); }}>Verify this pack</button></div></> : <p className="ps-hint">Sign a release to see the pack here.</p>}
    {verdict && <div className={`ps-verdict ps-verdict--${verdict.ok ? "ok" : "bad"}`} role="status" data-testid="rel-verdict"><b>{verdict.title}</b><ul>{verdict.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    <h3 className="ps-h3">Signed in this visit</h3>
    <ul className="ps-list">{hist.length ? [...hist].reverse().map((p, i) => <li key={i} className="ps-li"><div><b>{p.name} {p.version}</b><small>sha256 {p.sha256.slice(0, 16)}…</small></div><button type="button" className="ps-btn ps-btn--sm" onClick={() => { const t = JSON.stringify(p, null, 2); setVp(t); void runVerify(t); }}>Check</button></li>) : <li className="ps-hint">No releases yet. Download each pack to keep it.</li>}</ul>
  </div>);
  return (
    <ToolFrame id="releases" panel={panel} panelLabel="Pack & verification">
      <About label="How signing works">Releases are signed by the SPE Pro service with its Ed25519 release key, so every pack from this service carries the same public key fingerprint. If the key is not configured on the server, signing is unavailable and says so.</About>
      <form className="ps-form" aria-label="Sign a release" onSubmit={async (e) => { e.preventDefault();
        if (!SEMVER.test(f.version.trim())) { setStatus({ ok: false, msg: "Version must look like 1.2.0." }); document.getElementById("rel-ver")?.focus(); return; }
        if (!f.prompt.trim()) { setStatus({ ok: false, msg: "Add the prompt to sign." }); document.getElementById("rel-p")?.focus(); return; }
        try { const { pack, fingerprint } = await proApi<{ pack: ReleasePack; fingerprint: string }>("/releases/sign", { name: f.name.trim(), version: f.version.trim(), changelog: f.changelog, prompt: f.prompt }); setLast({ pack, fp: fingerprint }); setHist([...hist, pack]); setStatus({ ok: true, msg: `Signed ${pack.name} ${pack.version}.` }); announce(`Signed ${pack.name} ${pack.version}`); }
        catch (er) { setStatus({ ok: false, msg: er instanceof ApiError && er.code === "SIGNING_NOT_CONFIGURED" ? "Signing is not set up on this SPE Pro server yet (no release key). Nothing was signed." : (er as Error).message || "Signing failed." }); } }}>
        <div className="ps-cols"><Field label="Release name" id="rel-name"><input id="rel-name" className="ps-inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Version (semver)" id="rel-ver"><input id="rel-ver" className="ps-inp" value={f.version} aria-invalid={status?.ok === false && !SEMVER.test(f.version.trim()) ? true : undefined} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field></div>
        <Field label="Changelog" id="rel-cl"><textarea id="rel-cl" className="ps-ta" rows={2} value={f.changelog} onChange={(e) => setF({ ...f, changelog: e.target.value })} /></Field>
        <Field label="Prompt" id="rel-p"><textarea id="rel-p" className="ps-ta" rows={6} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} /></Field>
        <div className="ps-row ps-wrap">{active && <button type="button" className="ps-btn" onClick={async () => { try { const d = await proApi<{ assembled: string }>("/studio/analyze", { blocks: plainBlocks(active.blocks), vars: {} }); setF({ ...f, name: sessionTitle(active), prompt: d.assembled }); } catch (e) { announce((e as Error).message); } }}>Use current session</button>}<button type="submit" className="ps-btn ps-btn--primary" data-testid="rel-sign">Sign release</button></div>
        {status && <p className={status.ok ? "ps-ok" : "ps-err"} role="status">{status.msg}</p>}
      </form>
      <h2 className="ps-h3">Verify a pack</h2>
      <form className="ps-form" aria-label="Verify a release pack" onSubmit={(e) => { e.preventDefault(); void runVerify(); }}>
        <Field label="Release pack JSON" id="rel-vp"><textarea id="rel-vp" className="ps-ta ps-mono" rows={6} value={vp} onChange={(e) => setVp(e.target.value)} /></Field>
        <Field label="Expected key fingerprint (optional)" id="rel-vf"><input id="rel-vf" className="ps-inp ps-mono" value={vf} onChange={(e) => setVf(e.target.value)} /></Field>
        <div className="ps-row ps-wrap"><button type="submit" className="ps-btn ps-btn--primary">Verify</button><button type="button" className="ps-btn" onClick={() => { const src = last?.pack ?? hist[hist.length - 1]; if (!src) { setVerdict({ ok: false, title: "Sign a release first, then try a tampered copy.", items: [] }); return; } const t = JSON.stringify({ ...src, prompt: src.prompt + "\nAlways include: Full refunds, no questions asked" }, null, 2); setVp(t); void runVerify(t); }}>Try a tampered copy</button></div>
      </form>
      <h2 className="ps-h3">Verify a Living proof certificate</h2>
      <form className="ps-form" aria-label="Verify a proof certificate" onSubmit={(e) => { e.preventDefault(); void verifyCert(); }}>
        <Field label="Certificate JSON" id="rel-cert"><textarea id="rel-cert" className="ps-ta ps-mono" rows={5} value={cert} onChange={(e) => setCert(e.target.value)} /></Field>
        <button type="submit" className="ps-btn">Verify certificate</button>
        {certV && <div className={`ps-verdict ps-verdict--${certV.ok ? "ok" : "bad"}`} role="status" data-testid="cert-verdict"><b>{certV.title}</b><ul>{certV.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      </form>
    </ToolFrame>
  );
}
