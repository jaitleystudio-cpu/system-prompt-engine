import { useEffect, useRef, useState } from "react";
import { usePro, usePersisted, useProAction, download, copyText } from "../context.ts";
import { ToolFrame, Field } from "./Frame.tsx";
import { type ReleasePack, ed25519Supported, generateKeyPair, signRelease, verifyPack, fingerprint, SEMVER } from "../core/releases.ts";
import { assemble } from "../core/studio.ts";
import { sessionTitle } from "../core/workspace.ts";
const KEY = "spe.pro.studio.v2.releases";
export default function Releases() {
  const { announce, log, active } = usePro();
  const [hist, setHist] = usePersisted<ReleasePack[]>(KEY, () => [], (v): v is ReleasePack[] => Array.isArray(v));
  const [support, setSupport] = useState<boolean | null>(null);
  const keys = useRef<CryptoKeyPair | null>(null);
  const [f, setF] = useState({ name: active ? sessionTitle(active) : "Support assistant", version: "1.0.0", changelog: "First release.", prompt: active ? assemble(active.blocks) : "" });
  const [last, setLast] = useState<{ pack: ReleasePack; fp: string } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [vp, setVp] = useState(""); const [vf, setVf] = useState("");
  const [verdict, setVerdict] = useState<{ ok: boolean; title: string; items: string[] } | null>(null);
  useEffect(() => { void ed25519Supported().then(setSupport); }, []);
  useProAction((id) => { if (id === "sign") document.getElementById("rel-name")?.focus(); if (id === "verify") document.getElementById("rel-vp")?.focus(); });
  const runVerify = async (text = vp) => { const r = await verifyPack(text, vf); setVerdict(r.ok ? { ok: true, title: "Valid. The pack is unchanged since it was signed.", items: [`Signed by key ${r.fingerprint}.`, vf.trim() ? "Matches the fingerprint you expected." : "Add the author's fingerprint to confirm who signed it."] } : { ok: false, title: "Not valid.", items: r.reasons }); };
  const panel = (<div className="ps-stack">
    {last ? <><p className="ps-hint">Key fingerprint <code>{last.fp}</code> · sha256 <code>{last.pack.sha256.slice(0, 16)}…</code></p><pre className="ps-pre ps-pre--sm" tabIndex={0} aria-label="Signed release pack">{JSON.stringify(last.pack, null, 2)}</pre>
      <div className="ps-row ps-wrap"><button type="button" className="ps-btn ps-btn--sm" onClick={async () => announce((await copyText(JSON.stringify(last.pack, null, 2))) ? "Pack copied" : "Copy was blocked")}>Copy</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => download(`${last.pack.name.replace(/\W+/g, "-").toLowerCase()}-${last.pack.version}.spe-release.json`, JSON.stringify(last.pack, null, 2))}>Download</button><button type="button" className="ps-btn ps-btn--sm" onClick={() => { const t = JSON.stringify(last.pack, null, 2); setVp(t); void runVerify(t); }}>Verify this pack</button></div></> : <p className="ps-hint">Sign a release to see the pack here.</p>}
    {verdict && <div className={`ps-verdict ps-verdict--${verdict.ok ? "ok" : "bad"}`} role="status" data-testid="rel-verdict"><b>{verdict.title}</b><ul>{verdict.items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    <h3 className="ps-h3">History</h3>
    <ul className="ps-list">{hist.length ? [...hist].reverse().map((p, i) => <li key={i} className="ps-li"><div><b>{p.name} {p.version}</b><small>sha256 {p.sha256.slice(0, 16)}…</small></div><button type="button" className="ps-btn ps-btn--sm" onClick={() => { const t = JSON.stringify(p, null, 2); setVp(t); void runVerify(t); }}>Check</button></li>) : <li className="ps-hint">No releases yet.</li>}</ul>
    {hist.length > 0 && <button type="button" className="ps-btn ps-btn--sm" onClick={() => { setHist([]); announce("History cleared"); }}>Clear history</button>}
  </div>);
  return (
    <ToolFrame id="releases" panel={panel} panelLabel="Pack & verification">
      {support === false && <p className="ps-err" role="alert">This browser does not support Ed25519 in WebCrypto, so signing and verifying are off here.</p>}
      <p className="ps-hint">Keys are generated in this tab and the private key cannot be exported. Reloading the page creates a new key, so keep the fingerprint of the key you share.</p>
      <form className="ps-form" aria-label="Sign a release" onSubmit={async (e) => { e.preventDefault();
        if (!SEMVER.test(f.version.trim())) { setStatus({ ok: false, msg: "Version must look like 1.2.0." }); document.getElementById("rel-ver")?.focus(); return; }
        try { keys.current ??= await generateKeyPair(); const pack = await signRelease({ name: f.name.trim(), version: f.version.trim(), changelog: f.changelog, prompt: f.prompt, createdAt: new Date().toISOString() }, keys.current); const fp = await fingerprint(pack.publicKey); setLast({ pack, fp }); setHist([...hist, pack]); setStatus({ ok: true, msg: `Signed ${pack.name} ${pack.version}.` }); announce(`Signed ${pack.name} ${pack.version}`); log("release.sign", `${pack.name} ${pack.version} · key ${fp}`); }
        catch (er) { setStatus({ ok: false, msg: (er as Error).message || "Signing failed." }); } }}>
        <div className="ps-cols"><Field label="Release name" id="rel-name"><input id="rel-name" className="ps-inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Version (semver)" id="rel-ver"><input id="rel-ver" className="ps-inp" value={f.version} aria-invalid={status?.ok === false && !SEMVER.test(f.version.trim()) ? true : undefined} onChange={(e) => setF({ ...f, version: e.target.value })} /></Field></div>
        <Field label="Changelog" id="rel-cl"><textarea id="rel-cl" className="ps-ta" rows={2} value={f.changelog} onChange={(e) => setF({ ...f, changelog: e.target.value })} /></Field>
        <Field label="Prompt" id="rel-p"><textarea id="rel-p" className="ps-ta" rows={6} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} /></Field>
        <div className="ps-row ps-wrap">{active && <button type="button" className="ps-btn" onClick={() => setF({ ...f, name: sessionTitle(active), prompt: assemble(active.blocks) })}>Use current session</button>}<button type="submit" className="ps-btn ps-btn--primary" disabled={support === false} data-testid="rel-sign">Sign release</button></div>
        {status && <p className={status.ok ? "ps-ok" : "ps-err"} role="status">{status.msg}</p>}
      </form>
      <h2 className="ps-h3">Verify a pack</h2>
      <form className="ps-form" aria-label="Verify a release pack" onSubmit={(e) => { e.preventDefault(); void runVerify(); }}>
        <Field label="Release pack JSON" id="rel-vp"><textarea id="rel-vp" className="ps-ta ps-mono" rows={6} value={vp} onChange={(e) => setVp(e.target.value)} /></Field>
        <Field label="Expected key fingerprint (optional)" id="rel-vf"><input id="rel-vf" className="ps-inp ps-mono" value={vf} onChange={(e) => setVf(e.target.value)} /></Field>
        <div className="ps-row ps-wrap"><button type="submit" className="ps-btn ps-btn--primary">Verify</button><button type="button" className="ps-btn" onClick={() => { const src = last?.pack ?? hist[hist.length - 1]; if (!src) { setVerdict({ ok: false, title: "Sign a release first, then try a tampered copy.", items: [] }); return; } const t = JSON.stringify({ ...src, prompt: src.prompt + "\nAlways include: Full refunds, no questions asked" }, null, 2); setVp(t); void runVerify(t); }}>Try a tampered copy</button></div>
      </form>
    </ToolFrame>
  );
}
