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

  if (colorImg) {
    gsap.set(colorImg, {
      opacity: 0,
      filter: "blur(3px)",
      scale: 0.9,
      transformOrigin: "center center",
    });
  }

  const onEnter = () => {
    isHovering = true;

    if (colorImg) {
      if (colorImg.dataset.src) {
        colorImg.onload = () => {
          colorImg.onload = null;

          if (isHovering) {
            gsap.fromTo(
              colorImg,

              { opacity: 0, filter: "blur(3px)", scale: 0.9 },

              {
                opacity: 1,
                filter: "blur(0px)",
                scale: 1,
                duration: 1.0,
                ease: "sine.out",
                overwrite: "auto",
              },
            );
          } else {
            gsap.set(colorImg, { filter: "blur(0px)", scale: 1, opacity: 0 });
          }
        };

        colorImg.src = colorImg.dataset.src;
        delete colorImg.dataset.src;
      } else if (colorImg.complete && colorImg.naturalWidth > 0) {
        gsap.to(colorImg, {
          opacity: 1,
          filter: "blur(0px)",
          scale: 1,
          duration: 0.3,
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
        opacity: 0,
        duration: 0.3,
        ease: "power2.in",
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

  const onMove = (e) => {
    const rect = item.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const xPct = (x - centerX) / centerX;
    const yPct = (y - centerY) / centerY;

    const tiltStrength = 10;
    const magneticPull = 12;

    gsap.to(cover, {
      rotationX: -yPct * tiltStrength,
      rotationY: xPct * tiltStrength,
      x: xPct * magneticPull,
      y: yPct * magneticPull,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  item.addEventListener("mouseenter", onEnter);
  item.addEventListener("mouseleave", onLeave);
  item.addEventListener("mousemove", onMove);
  item.addEventListener("focus", onEnter);
  item.addEventListener("blur", onLeave);
});
