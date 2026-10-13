import "../../pro-studio/pro/shared/shell.ts";
// Scroll reveal: progressive enhancement only. Content is visible without JS and with prefers-reduced-motion.
const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("rv"); io.observe(el); } });
}
// Hero product shot settles from a tilt to flat once (skipped under reduced motion via CSS).
const shot = document.querySelector(".hero__shot"); if (shot) requestAnimationFrame(() => setTimeout(() => shot.classList.add("is-flat"), 250));
