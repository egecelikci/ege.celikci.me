import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const items = document.querySelectorAll(".album__item");

gsap.set(items, {
  y: 50,
  opacity: 0,
  scale: 0.9,
  rotationX: 10,
  transformPerspective: 1000,
});

ScrollTrigger.batch(items, {
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
    }),
});

items.forEach((item) => {
  const colorImg = item.querySelector(".lazy-hover");

  const onEnter = () => {
    if (colorImg) {
      if (colorImg.dataset.src) {
        colorImg.src = colorImg.dataset.src;
        delete colorImg.dataset.src;
      }
    }
  };

  item.addEventListener("mouseenter", onEnter);
  item.addEventListener("focus", onEnter);
});
