import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Applies a modern staggered pop-up animation.
 * Restores the "elastic" feel with optimized batching.
 *
 * @param {string | Element | NodeList} items
 * @param {Object} options
 */
export function animateGridItems(items, options = {}) {
  const targets = gsap.utils.toArray(items);
  if (!targets.length) return;

  targets.forEach((target) => {
    ScrollTrigger.getAll().forEach((st) => {
      if (st.trigger === target) {
        st.kill();
      }
    });
    gsap.killTweensOf(target);
    gsap.set(target, { clearProps: "all" });
  });

  gsap.set(targets, {
    y: 50,
    opacity: 0,
    scale: 0.9,
    rotationX: 15,
    transformPerspective: 1000,
    transformOrigin: "center center",
    willChange: "transform, opacity",
  });

  const batchId = `batch-${Date.now()}-${Math.random()}`;

  ScrollTrigger.batch(targets, {
    id: batchId,
    interval: 0.1,
    batchMax: 6,
    start: "top 95%",
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        scale: 1,
        rotationX: 0,
        stagger: {
          each: 0.05,
          grid: "auto",
          from: "start",
        },
        duration: 0.8,
        ease: "elastic.out(1, 0.75)",
        clearProps: "willChange,transformPerspective,rotationX",
        ...options,
      });
    },
  });

  return batchId;
}
