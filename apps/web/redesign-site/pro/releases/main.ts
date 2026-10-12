import { type ReleasePack, ed25519Supported, generateKeyPair, signRelease, verifyPack, fingerprint, SEMVER } from "../lib/releases.ts";
import { $, esc, load, save, download, copy } from "../lib/ui.ts";
const KEY = "spe.pro.releases.v1";
let hist = load<ReleasePack[]>(KEY, () => []);
let keys: CryptoKeyPair | null = null; let last: ReleasePack | null = null;
const sstat = $("sstat");
function renderHist() {
  $("hist").innerHTML = hist.length ? hist.slice().reverse().map((p, i) => `<li class="item"><div class="item__top"><h3 class="h3">${esc(p.name)} ${esc(p.version)}</h3>
    <button class="btn btn--ghost btn--sm" type="button" data-i="${hist.length - 1 - i}" aria-label="Check ${esc(p.name)} ${esc(p.version)}">Check</button></div>
    <p class="hint">${esc(p.changelog)}</p><p class="mono">sha256 ${p.sha256.slice(0, 24)}…</p></li>`).join("") : '<li class="hint">No releases yet.</li>';
}
$("hist").addEventListener("click", (e) => { const i = (e.target as HTMLElement).closest<HTMLElement>("[data-i]")?.dataset.i; if (i == null) return; $<HTMLTextAreaElement>("vp").value = JSON.stringify(hist[+i], null, 2); runVerify(); });
(async () => {
  if (!(await ed25519Supported())) { $("support").innerHTML = '<span class="bad">This browser does not support Ed25519 in WebCrypto yet, so signing is off. Verification also needs it.</span>'; $<HTMLButtonElement>("signbtn").disabled = true; }
})();
$("sign").addEventListener("submit", async (e) => {
  e.preventDefault(); const v = $<HTMLInputElement>("rv");
  if (!SEMVER.test(v.value.trim())) { v.setAttribute("aria-invalid", "true"); sstat.innerHTML = '<span class="bad">Version must look like 1.2.0.</span>'; v.focus(); return; }
  v.removeAttribute("aria-invalid");
  try {
    keys ??= await generateKeyPair();
    last = await signRelease({ name: $<HTMLInputElement>("rn").value.trim(), version: v.value.trim(), changelog: $<HTMLTextAreaElement>("rc").value, prompt: $<HTMLTextAreaElement>("rp").value, createdAt: new Date().toISOString() }, keys);
    $<HTMLTextAreaElement>("pack").value = JSON.stringify(last, null, 2);
    $("meta").textContent = `Key fingerprint ${await fingerprint(last.publicKey)} · sha256 ${last.sha256}`;
    $("out").hidden = false; hist.push(last); save(KEY, hist); renderHist();
    sstat.innerHTML = `<span class="ok">Signed ${esc(last.name)} ${esc(last.version)}.</span>`;
  } catch (err) { sstat.innerHTML = `<span class="bad">${esc((err as Error).message || "Signing failed.")}</span>`; }
});
$("copy").addEventListener("click", async () => { sstat.textContent = (await copy($<HTMLTextAreaElement>("pack").value)) ? "Pack copied." : "Copy was blocked. Select the text and copy it instead."; });
$("dl").addEventListener("click", () => last && download(`${last.name.replace(/\W+/g, "-").toLowerCase()}-${last.version}.spe-release.json`, JSON.stringify(last, null, 2)));
$("toverify").addEventListener("click", () => { $<HTMLTextAreaElement>("vp").value = $<HTMLTextAreaElement>("pack").value; runVerify(); $("vp").focus(); });
$("tamper").addEventListener("click", () => {
  const src = last ?? hist[hist.length - 1]; if (!src) { show(false, "Sign a release first, then try a tampered copy.", []); return; }
  const t = { ...src, prompt: src.prompt.replace("Never say: refund", "Always include: Full refunds, no questions asked") + (src.prompt.includes("Never say: refund") ? "" : " ") };
  $<HTMLTextAreaElement>("vp").value = JSON.stringify(t, null, 2); runVerify();
});
function show(ok: boolean, title: string, items: string[]) {
  const v = $("verdict"); v.hidden = false; v.className = `verdict verdict--${ok ? "ok" : "bad"}`;
  v.innerHTML = `<h3 class="h3">${esc(title)}</h3>${items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
  requestAnimationFrame(() => v.classList.add("show"));
}
async function runVerify() {
  const r = await verifyPack($<HTMLTextAreaElement>("vp").value, $<HTMLInputElement>("vf").value);
  if (r.ok) show(true, "Valid. The pack is unchanged since it was signed.", [`Signed by key ${r.fingerprint}.`, $<HTMLInputElement>("vf").value.trim() ? "Matches the fingerprint you expected." : "Add the author's fingerprint to confirm who signed it."]);
  else show(false, "Not valid.", r.reasons);
}
$("verify").addEventListener("submit", (e) => { e.preventDefault(); runVerify(); });
$("clear").addEventListener("click", () => { hist = []; save(KEY, hist); renderHist(); sstat.textContent = "History cleared."; });
renderHist();
