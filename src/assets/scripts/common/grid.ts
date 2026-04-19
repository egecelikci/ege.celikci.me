import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger,);

export function animateGridItems(
  items: string | Element | NodeList | any[],
): void {
  const targets = gsap.utils.toArray(items,);
  if (!targets.length) return;

  gsap.set(targets, {
    opacity: 0,
    y: 20,
  });

  ScrollTrigger.batch(targets, {
    onEnter: (batch) => gsap.to(batch, {
      opacity: 1,
      y: 0,
      stagger: 0.1,
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
    }),
    start: "top 95%",
    once: true,
  });
}
