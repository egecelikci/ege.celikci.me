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

    // Update each status element
    newElements.forEach((newEl, index) => {
      const statusEl = statusElements[index];
      if (!statusEl) return;

      const targetText = newEl.dataset.status;
      const targetHTML = newEl.innerHTML;

      statusEl.dataset.status = targetText;
      statusEl.dataset.chars = "█";

      gsap.to(statusEl, {
        scrambleText: {
          text: targetText,
          chars: "█",
          speed: 0.1,
        },
        duration: 1.5,
        ease: "power2.inOut",
        onComplete: () => {
          statusEl.innerHTML = targetHTML;
        },
      });
    });
  } catch (err) {
    console.error("Status error:", err);
  }
}

loadStatus();
