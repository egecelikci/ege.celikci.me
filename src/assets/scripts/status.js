import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

const CONFIG = {
  baseInterval: 15000,
  maxInterval: 120000,
  backoffFactor: 1.5,
};

let currentInterval = CONFIG.baseInterval;
let pollTimeout = null;
let abortController = null;

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
  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const res = await fetch("/.netlify/functions/status", {
      signal: abortController.signal,
    });

    currentInterval = CONFIG.baseInterval;

    const html = res.status === 204 ? "" : await res.text();

    if (!res.ok && res.status !== 204) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const temp = document.createElement("div");
    temp.innerHTML = `<div>${html}</div>`;

    updateUI(temp);
  } catch (err) {
    if (err.name === "AbortError") return;

    console.warn("Status fetch failed, backing off:", err);

    currentInterval = Math.min(
      currentInterval * CONFIG.backoffFactor,
      CONFIG.maxInterval,
    );
  } finally {
    if (document.visibilityState === "visible") {
      pollTimeout = setTimeout(loadStatus, currentInterval);
    }
  }
}

function updateUI(tempDom) {
  gsap.context(() => {
    const mapping = [
      { id: "#music-status-container", newId: "#music-status" },
      { id: "#game-status-container", newId: "#game-status" },
      { id: "#manga-status-container", newId: "#manga-status" },
    ];

    mapping.forEach(({ id, newId }) => {
      const placeholder = document.querySelector(id);
      const newData = tempDom.querySelector(newId);

      if (!placeholder) return;
      const li = placeholder.closest("li");

      if (!newData) {
        if (li) li.hidden = true;
        return;
      }

      if (li) li.hidden = false;

      const newSpan = newData.querySelector("span");
      const currentSpan = placeholder.querySelector("span");

      const newTxt = newSpan?.dataset.status || newSpan?.textContent || "";
      const curTxt = currentSpan
        ? currentSpan.dataset.status || currentSpan.textContent
        : "";

      if (newTxt === curTxt) return;

      const richHTML = newSpan.innerHTML;
      placeholder.replaceChildren(newSpan);

      // 4. Animate
      gsap.to(newSpan, {
        y: 0,
        ease: "power2.out",
        duration: 1.5,
        scrambleText: {
          text: newTxt,
          chars: "█",
          speed: 0.1,
        },
        onComplete: () => {
          newSpan.innerHTML = richHTML;
          createMarqueeAnimation(newSpan, richHTML);
        },
      });
    });
  });
}

loadStatus();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (pollTimeout) clearTimeout(pollTimeout);
    currentInterval = CONFIG.baseInterval;
    loadStatus();
  } else {
    if (pollTimeout) clearTimeout(pollTimeout);
    if (abortController) abortController.abort();
  }
});
