import gsap from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

function createMarqueeAnimation(element, originalHTML) {
  const wrapper = element.parentElement;
  if (element.scrollWidth <= wrapper.clientWidth) return;

  const spacer = "&nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp;";

  gsap.delayedCall(0, () => {
    element.innerHTML = `<span>${originalHTML}${spacer}</span>${originalHTML}`;
    const distance = element.firstElementChild.offsetWidth;
    element.innerHTML = originalHTML + spacer + originalHTML;

    const speed = 50;
    const duration = distance / speed;

    gsap.to(element, {
      x: -distance,
      duration: duration,
      ease: "none",
      repeat: -1,
    });
  });
}

async function loadStatus() {
  if (!document.querySelector(".status")) return;

  try {
    const res = await fetch("/.netlify/functions/status");
    if (!res.ok || res.status === 204) return;

    const html = await res.text();
    const temp = document.createElement("div");
    temp.innerHTML = `<div>${html}</div>`;

    gsap.context(() => {
      const musicPlaceholder = document.querySelector(
        "#music-status-container",
      );
      const gamePlaceholder = document.querySelector("#game-status-container");

      const newMusicDiv = temp.querySelector("#music-status");
      const newGameDiv = temp.querySelector("#game-status");

      const processStatus = (placeholder, newData, delay) => {
        if (!placeholder || !newData) return;

        const newSpan = newData.querySelector("span");
        if (!newSpan) return;

        const richHTML = newSpan.innerHTML;

        placeholder.replaceChildren(newSpan);
        const el = newSpan;

        gsap.to(el, {
          y: 0,
          ease: "power2.out",
          duration: 1.5,
          delay: delay,
          scrambleText: {
            text: newSpan.dataset.status,
            chars: "█",
            speed: 0.1,
          },
          onComplete: () => {
            el.innerHTML = richHTML;
            createMarqueeAnimation(el, richHTML);
          },
        });
      };

      processStatus(musicPlaceholder, newMusicDiv, 0);
      processStatus(gamePlaceholder, newGameDiv, 0);
    });
  } catch (err) {
    console.error("Status error:", err);
  }
}

loadStatus();
