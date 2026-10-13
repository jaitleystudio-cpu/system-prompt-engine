import { type TestCase, type DiffReport, runSuite, diffReports, splitList } from "../core/regression.ts";
import { $, esc, load, save, uid } from "../core/ui.ts";
import "../../../pro-studio/pro/shared/shell.ts";
const KEY = "spe.pro.regression.v1";
interface State { a: string; b: string; cases: TestCase[] }
const example = (): State => ({
  a: "You are the support assistant for a bike repair shop.\nHelp the customer choose the right repair.",
  b: "You are the support assistant for a bike repair shop.\nHelp the customer choose the right repair.\nNever say: refund\nAlways include: Our staff can confirm the price in store\nMax words: 40",
  cases: [
    { id: "c1", name: "Refund request", input: "My brakes squeal. Can I get a refund?", mustInclude: [], mustNotInclude: ["refund you"], format: "any", maxWords: null },
    { id: "c2", name: "Mentions the shop", input: "How much is a new chain?", mustInclude: ["staff"], mustNotInclude: [], format: "any", maxWords: null },
    { id: "c3", name: "Stays short", input: "What should I do about a flat tyre?", mustInclude: [], mustNotInclude: [], format: "any", maxWords: 40 },
    { id: "c4", name: "Bullet answer", input: "List what a tune-up covers", mustInclude: [], mustNotInclude: [], format: "bullets", maxWords: null },
  ] });
let st = load<State>(KEY, example);
const pa = $<HTMLTextAreaElement>("pa"), pb = $<HTMLTextAreaElement>("pb");
const persist = () => save(KEY, st);
function renderCases() {
  $("cases").innerHTML = st.cases.map((c) => `<li class="item"><div class="item__top"><h3 class="h3">${esc(c.name)}</h3>
    <button class="btn btn--ghost btn--sm" type="button" data-del="${c.id}" aria-label="Remove case ${esc(c.name)}">Remove</button></div>
    <p class="mono">“${esc(c.input)}”</p><div class="chips">${[
      ...c.mustInclude.map((t) => `must include: ${t}`), ...c.mustNotInclude.map((t) => `must not include: ${t}`),
      ...(c.format !== "any" ? [`format: ${c.format}`] : []), ...(c.maxWords ? [`max ${c.maxWords} words`] : [])].map((t) => `<span class="chip">${esc(t)}</span>`).join("") || '<span class="chip">no checks yet</span>'}</div></li>`).join("");
}
function render() { pa.value = st.a; pb.value = st.b; renderCases(); }
$("cases").addEventListener("click", (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>("[data-del]")?.dataset.del; if (!id) return;
  const name = st.cases.find((c) => c.id === id)?.name; st.cases = st.cases.filter((c) => c.id !== id); persist(); renderCases();
  $("status").textContent = `Removed “${name}”.`; $("cn").focus();
});
pa.addEventListener("input", () => { st.a = pa.value; persist(); });
pb.addEventListener("input", () => { st.b = pb.value; persist(); });
$("add").addEventListener("submit", (e) => {
  e.preventDefault(); const n = $<HTMLInputElement>("cn"), err = $("cn-err");
  if (!n.value.trim()) { n.setAttribute("aria-invalid", "true"); err.hidden = false; n.focus(); return; }
  n.removeAttribute("aria-invalid"); err.hidden = true; const w = parseInt($<HTMLInputElement>("cw").value, 10);
  st.cases.push({ id: uid(), name: n.value.trim(), input: $<HTMLInputElement>("ci").value.trim(), mustInclude: splitList($<HTMLInputElement>("cy").value),
    mustNotInclude: splitList($<HTMLInputElement>("cx").value), format: $<HTMLSelectElement>("cf").value as TestCase["format"], maxWords: w > 0 ? w : null });
  persist(); renderCases(); $("status").textContent = `Added “${n.value.trim()}”. ${st.cases.length} cases.`; (e.target as HTMLFormElement).reset(); n.focus();
});
const pill = (p: boolean) => `<span class="pill pill--${p ? "pass" : "fail"}">${p ? "Pass" : "Fail"}</span>`;
const label: Record<string, [string, string]> = { fixed: ["Fixed", "fixed"], regressed: ["Broke", "regressed"], "still-pass": ["Still passing", "same"], "still-fail": ["Still failing", "same"], new: ["New", "same"], removed: ["Removed", "same"] };
function renderReport(d: DiffReport) {
  $("sum").innerHTML = `<div><b>${d.passA}/${d.total}</b><span>Version A passing</span></div><div><b>${d.passB}/${d.total}</b><span>Version B passing</span></div>
    <div><b class="ok">${d.counts.fixed}</b><span>Fixed by B</span></div><div><b class="${d.counts.regressed ? "bad" : ""}">${d.counts.regressed}</b><span>Broken by B</span></div>`;
  $("rows").innerHTML = d.rows.map((r) => `<tr><th scope="row">${esc(r.name)}
    <details><summary>Show answers and checks</summary>${[["A", r.a], ["B", r.b]].map(([v, x]: any) => x ? `<p class="hint">Version ${v} (simulated answer)</p><p class="mono">${esc(x.output)}</p>
    <ul class="hint">${x.checks.map((c: any) => `<li>${c.pass ? "✓" : "✗"} ${esc(c.kind)}: ${esc(c.detail)}</li>`).join("") || "<li>No checks on this case.</li>"}</ul>` : "").join("")}</details></th>
    <td>${r.a ? pill(r.a.pass) : "–"}</td><td>${r.b ? pill(r.b.pass) : "–"}</td><td><span class="pill pill--${label[r.change][1]}">${label[r.change][0]}</span></td></tr>`).join("");
  $("report").hidden = false;
}
$("run").addEventListener("click", () => {
  if (!st.cases.length) { $("status").textContent = "Add at least one test case first."; return; }
  const d = diffReports(runSuite(st.a, st.cases), runSuite(st.b, st.cases)); renderReport(d);
  $("status").textContent = `Simulated run finished. Version B fixed ${d.counts.fixed} and broke ${d.counts.regressed} of ${d.total} cases.`;
});
$("reset").addEventListener("click", () => { st = example(); persist(); render(); $("report").hidden = true; $("status").textContent = "Example restored."; });
render();
window.addEventListener("spe:action", (e) => { const id = (e as CustomEvent).detail; if (id === "add-case") { $("cn").scrollIntoView({ block: "center" }); $("cn").focus(); } if (id === "run-tests") { $("run").click(); $("report").scrollIntoView({ block: "start" }); } });
