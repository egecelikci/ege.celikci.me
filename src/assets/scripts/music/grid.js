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
  const cover = item.querySelector(".album__cover");
  const colorImg = item.querySelector(".lazy-hover");
  let isHovering = false;

  const onEnter = () => {
    isHovering = true;

    if (colorImg) {
      if (colorImg.dataset.src) {
        colorImg.onload = () => {
          colorImg.onload = null;

          if (isHovering) {
            gsap.fromTo(
              colorImg,
              { clipPath: "inset(0 100% 0 0)" },
              {
                clipPath: "inset(0 0% 0 0)",
                duration: 0.6,
                ease: "power3.inOut",
                overwrite: "auto",
              },
            );
          } else {
            gsap.set(colorImg, { scale: 1, opacity: 0 });
          }
        };

        colorImg.src = colorImg.dataset.src;
        delete colorImg.dataset.src;
      } else if (colorImg.complete && colorImg.naturalWidth > 0) {
        gsap.to(colorImg, {
          clipPath: "inset(0 0% 0 0)",
          duration: 0.4,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    }

    gsap.set(item, { zIndex: 100 });
    gsap.to(cover, {
      boxShadow: "8px 8px 0px currentcolor",
      scale: 1.05,
      duration: 0.4,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  const onLeave = () => {
    isHovering = false;

    if (colorImg) {
      gsap.to(colorImg, {
        clipPath: "inset(0 100% 0 0)",
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    gsap.delayedCall(0.5, () => {
      if (!item.matches(":hover")) {
        gsap.set(item, { zIndex: 1 });
      }
    });

    gsap.to(cover, {
      x: 0,
      y: 0,
      boxShadow: "0px 0px 0px currentcolor",
      scale: 1,
      rotationX: 0,
      rotationY: 0,
      duration: 0.7,
      ease: "elastic.out(1, 0.6)",
      overwrite: "auto",
    });
  };

  item.addEventListener("mouseenter", onEnter);
  item.addEventListener("mouseleave", onLeave);
  item.addEventListener("focus", onEnter);
  item.addEventListener("blur", onLeave);
});
