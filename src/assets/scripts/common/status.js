import gsap from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";
gsap.registerPlugin(ScrambleTextPlugin);

async function loadStatus() {
  const statusEl = document.querySelector(".status [data-status]");
  if (!statusEl) return;

  try {
    const res = await fetch("/.netlify/functions/status");
    if (!res.ok) return;

    const html = await res.text();
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const newEl = temp.firstElementChild;
    if (!newEl) return;

    const targetText = newEl.dataset.status;
    const targetHTML = newEl.innerHTML;

    statusEl.dataset.status = targetText;
    statusEl.dataset.chars = "X";

    gsap.to(statusEl, {
      scrambleText: {
        text: targetText,
        chars: "X",
        speed: 0.1,
      },
      duration: 1.5,
      ease: "power2.inOut",
      onComplete: () => {
        statusEl.innerHTML = targetHTML;
      },
    });
  } catch (err) {
    console.error("Status error:", err);
  }
}

loadStatus();
