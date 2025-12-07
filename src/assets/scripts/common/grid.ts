import { gsap, } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger.js";

gsap.registerPlugin(ScrollTrigger,);

/**
 * Applies a modern staggered pop-up animation.
 * Restores the "elastic" feel with optimized batching.
 */
export function animateGridItems(
  items: string | Element | NodeList | any[],
  options: gsap.TweenVars = {},
): string | undefined {
  const targets = gsap.utils.toArray(items,);
  if (!targets.length) return;

  targets.forEach((target: any,) => {
    ScrollTrigger.getAll().forEach((st,) => {
      if (st.trigger === target) {
        st.kill();
      }
    },);
    gsap.killTweensOf(target,);
    gsap.set(target, { clearProps: "all", },);
  },);

  gsap.set(targets, {
    y: 50,
    opacity: 0,
    scale: 0.9,
    rotationX: 15,
    transformPerspective: 1000,
    transformOrigin: "center center",
    willChange: "transform, opacity",
  },);

  const batchId = `batch-${Date.now()}-${Math.random()}`;

  ScrollTrigger.batch(targets, {
    id: batchId,
    interval: 0.2,
    batchMax: 6,
    start: "top 95%",
    once: true,
    onEnter: (batch,) => {
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
      },);
    },
  },);

  return batchId;
}
