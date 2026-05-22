/**
 * Touch and Scroll Reveal Logic (Optimized Lens)
 * Uses native IntersectionObserver for buttery smooth scrolling performance.
 * Defines a "center lens" where multiple items can be active at once.
 */
export function initTouchReveal(selector: string) {
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;

  document.addEventListener("touchstart", (e) => {
    const group = (e.target as HTMLElement).closest(".group");
    if (!group) return;
    group.classList.add("is-active");
  }, { passive: true });

  document.addEventListener("touchend", () => {
    document.querySelectorAll(".group.is-active").forEach((el) => {
      el.classList.remove("is-active");
    });
  }, { passive: true });

  const items = document.querySelectorAll(selector);
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-active");
      } else {
        entry.target.classList.remove("is-active");
      }
    });
  }, {
    // The "active" zone is the central 40% of the screen.
    // This allows multiple rows of items to be active at once,
    // making the experience feel natural and responsive.
    rootMargin: "-30% 0px -30% 0px",
    threshold: 0.1,
  });

  items.forEach((el) => observer.observe(el));
}
