import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Applies a staggered pop-up animation to a batch of grid items.
 * Reusable for both Music and Notes grids.
 *
 * @param {string | Element | NodeList} items - The grid items to animate
 * @param {Object} options - Optional overrides for animation parameters
 */
export function animateGridItems(items, options = {}) {
  const targets = gsap.utils.toArray(items);

  if (!targets.length) return;

  // Clear any existing triggers/styles to prevent conflicts
  targets.forEach((t) => {
    const st = ScrollTrigger.getById(t);
    if (st) st.kill();
  });
  gsap.set(targets, { clearProps: "all" });

  // Initial State
  gsap.set(targets, {
    y: 50,
    opacity: 0,
    scale: 0.9,
    rotationX: 10,
    transformPerspective: 1000,
  });

  // Batch Animation
  ScrollTrigger.batch(targets, {
    interval: 0.1,
    batchMax: 12,
    start: "top 95%",
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        scale: 1,
        rotationX: 0,
        stagger: 0.05,
        overwrite: true,
        duration: 0.8,
        ease: "elastic.out(1, 0.75)",
        ...options,
      }),
  });
}

// Auto-initialize album grid if elements exist
const albumItems = document.querySelectorAll(".album__item");
if (albumItems.length) {
  animateGridItems(albumItems);
}
