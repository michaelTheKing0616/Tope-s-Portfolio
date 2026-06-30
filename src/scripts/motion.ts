import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Progressive enhancement entry point. Elements are visible by default if this
 * never runs (JS off) and revealed instantly when reduced motion is requested.
 */
export function initMotion(): void {
  document.documentElement.classList.add("js-ready");

  if (prefersReducedMotion()) {
    document
      .querySelectorAll<HTMLElement>("[data-reveal]")
      .forEach((el) => el.classList.add("is-visible"));
    initNav();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("reveal-ready");

  // Staggered reveal-on-scroll.
  const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  reveals.forEach((el) => {
    const delay = Number(el.dataset.revealDelay ?? 0);
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        gsap.delayedCall(delay, () => el.classList.add("is-visible"));
      },
    });
  });

  // Subtle parallax for any [data-parallax] element.
  gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
    const depth = Number(el.dataset.parallax ?? 0.15);
    gsap.to(el, {
      yPercent: -depth * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  });

  initNav();
  initMagnetic();
}

/** Nav background shift once the user scrolls past the hero band. */
function initNav(): void {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/** Gentle magnetic pull on primary CTAs (pointer devices only). */
function initMagnetic(): void {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic ?? 0.3);
    el.addEventListener("pointermove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    });
  });
}
