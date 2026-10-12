// Hero signature moment: the brief is read phrase by phrase and each phrase lands in its slot.
// DOM + CSS only. No canvas, no 3D, no network. Honors prefers-reduced-motion and a visible pause control.
const keys = ["role", "goal", "rule", "out"] as const;
const marks = keys.map((k) => document.querySelector<HTMLElement>(`#raw mark[data-k="${k}"]`)!);
const slots = keys.map((k) => document.querySelector<HTMLElement>(`.slot[data-k="${k}"]`)!);
const toggle = document.getElementById("motion") as HTMLButtonElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let timer = 0, step = 0, paused = false;

function setAll(on: boolean) { [...marks, ...slots].forEach((el) => el.classList.toggle("on", on)); }
function tick() {
  if (step < keys.length) { marks[step].classList.add("on"); slots[step].classList.add("on"); step++; timer = window.setTimeout(tick, 1100); }
  else { timer = window.setTimeout(() => { setAll(false); step = 0; timer = window.setTimeout(tick, 700); }, 2600); }
}
function start() { clearTimeout(timer); if (reduce.matches || paused) { setAll(true); return; } setAll(false); step = 0; timer = window.setTimeout(tick, 600); }
toggle.addEventListener("click", () => {
  paused = !paused; toggle.setAttribute("aria-pressed", String(paused));
  toggle.textContent = paused ? "Play animation" : "Pause animation"; start();
});
reduce.addEventListener("change", start);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(timer); else start(); });
start();

// Before / after toggle
const segs = document.querySelectorAll<HTMLButtonElement>(".seg__b");
const docs = document.querySelectorAll<HTMLElement>(".doc");
segs.forEach((b) => b.addEventListener("click", () => {
  segs.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  docs.forEach((d) => (d.hidden = d.dataset.v !== b.dataset.v));
}));
