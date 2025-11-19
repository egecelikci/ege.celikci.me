import gsap from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";
gsap.registerPlugin(ScrambleTextPlugin);

async function loadStatus() {
  const statusElements = document.querySelectorAll(".status [data-status]");
  if (!statusElements.length) return;

  try {
    const res = await fetch("/.netlify/functions/status");
    if (!res.ok) return;

    const html = await res.text();
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const newElements = temp.querySelectorAll("[data-status]");

    statusElements.forEach((el, i) => {
      if (newElements[i]) {
        el.dataset.status = newElements[i].dataset.status;
      }
    });
    gsap.set(statusElements, { opacity: 0, y: 10 });

    gsap.to(statusElements, {
      opacity: 1,
      y: 0,
      ease: "power2.out",
      stagger: 0.125,
      duration: 1,
      scrambleText: {
        text: (i) => statusElements[i].dataset.status,
        chars: "█",
        speed: 0.3,
      },
      innerHTML: (i) => newElements[i].innerHTML,
    });
  } catch (err) {
    console.error("Status error:", err);
  }
}

loadStatus();
