import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin);

const CONFIG = {
  baseInterval: 5000,
  maxInterval: 120000,
  backoffFactor: 1.5,
};

const STATUS_ORDER = ["music-status", "game-status", "manga-status"];

// ROBUSTNESS: Store active GSAP contexts per DOM element.
// This allows us to cleanly kill ANY running animation (scramble OR marquee)
// for a specific container before starting a new one.
const activeContexts = new WeakMap();

let currentInterval = CONFIG.baseInterval;
let pollTimeout = null;
let abortController = null;

/**
 * Creates the scrolling marquee effect.
 * MUST be called within a GSAP Context to ensure cleanup.
 */
function createMarqueeAnimation(element) {
  const wrapper = element.parentElement;
  if (!wrapper || element.scrollWidth <= wrapper.clientWidth) return;

  const spacer = "&nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp;";

  // Prepare content for looping
  // Using generic content since originalHTML is closure-scoped in previous versions but
  // needs to be accessible here. Ideally passed as arg or stored on element.
  // For this implementation, we assume element.innerHTML is the source of truth
  // or simple cloning. A safer pattern for this specific function:
  const originalContent = element.innerHTML;
  element.innerHTML = `<span>${originalContent}${spacer}</span>${originalContent}`;

  const distance = element.firstElementChild.offsetWidth;
  element.innerHTML = originalContent + spacer + originalContent;

  const speed = 50;
  const duration = distance / speed;

  const marqueeTween = gsap.to(element, {
    x: -distance,
    duration: duration,
    ease: "none",
    repeat: -1,
  });

  // ROBUSTNESS: Use properties (.on...) instead of addEventListener.
  // This automatically overwrites previous listeners, preventing duplicates
  // if this function runs multiple times on the same persistent wrapper.
  const pause = () => marqueeTween.pause();
  const play = () => marqueeTween.play();

  wrapper.onmouseenter = pause;
  wrapper.onmouseleave = play;
  wrapper.ontouchstart = (e) => {
    e.passive = true;
    pause();
  };
  wrapper.ontouchend = play;
  wrapper.ontouchcancel = play;
}

async function loadStatus() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  try {
    const res = await fetch("/.netlify/functions/status", {
      signal: abortController.signal,
    });

    if (!res.ok) throw new Error(`Server responded with ${res.status}`);

    currentInterval = CONFIG.baseInterval;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop();

      for (const part of parts) {
        if (part.trim()) processChunk(part);
      }
    }

    if (buffer.trim()) processChunk(buffer);
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

function processChunk(htmlString) {
  const temp = document.createElement("div");
  temp.innerHTML = htmlString;
  const newElement = temp.firstElementChild;
  if (!newElement) return;

  const id = newElement.id;
  const mapping = {
    "music-status": "#music-status-container",
    "game-status": "#game-status-container",
    "manga-status": "#manga-status-container",
  };

  const containerSelector = mapping[id];
  if (!containerSelector) return;

  const placeholder = document.querySelector(containerSelector);
  if (!placeholder) return;

  updateSingleUI(placeholder, newElement);
}

function updateSingleUI(container, newData) {
  const li = container.closest("li");
  if (li) li.hidden = false;

  const currentInner = container.querySelector(`[id="${newData.id}"]`);

  const getTxt = (el) => {
    const s = el?.querySelector("span");
    return s?.dataset.status || s?.textContent || "";
  };

  const newTxt = getTxt(newData);
  const curTxt = getTxt(currentInner);

  // Skip update if content is identical
  if (newTxt === curTxt && curTxt !== "") return;

  // ROBUSTNESS: Clean up ANY previous animation on this container immediately.
  // This kills old marquees, stops old scrambles, and removes GSAP-added styles.
  if (activeContexts.has(container)) {
    activeContexts.get(container).revert();
  }

  const newSpan = newData.querySelector("span");
  const richHTML = newSpan.innerHTML;
  const scrambleChar = newSpan.dataset.chars || "█";
  const placeholderChar = newSpan.dataset.chars || "█";

  // UPDATED: Use only the provided char (e.g. "×") for noise, removing random characters.
  const scrambleNoise = placeholderChar;

  // Dynamic calculations
  const index = STATUS_ORDER.indexOf(newData.id);
  const dynamicDelay = index !== -1 ? index * 0.125 : 0;
  const scrambleDuration = 1 + newTxt.length * 0.03;

  // State initialization
  if (curTxt) {
    newSpan.textContent = curTxt;
  } else {
    newSpan.style.opacity = "0";
  }

  // Accessibility: Set aria-label on container so screen readers read the clean text
  container.setAttribute("aria-label", newTxt);
  container.innerHTML = "";
  container.appendChild(newData);

  // Create new GSAP Context
  const ctx = gsap.context(() => {
    gsap.set(newSpan, {
      opacity: curTxt ? 1 : 0,
      y: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "block",
      maxWidth: "100%",
    });

    const tl = gsap.timeline({
      delay: dynamicDelay,
      onComplete: () => {
        // Wrap marquee creation in ctx.add() so it is ALSO tracked/killed by revert()
        ctx.add(() => {
          newSpan.dataset.unscrambled = "true";
          gsap.set(newSpan, {
            overflow: "visible",
            textOverflow: "clip",
            maxWidth: "none",
          });
          newSpan.innerHTML = richHTML;
          createMarqueeAnimation(newSpan);
        });
      },
    });

    if (curTxt) {
      // UPDATE SEQUENCE: Direct scramble from Old -> New
      // Removed the intermediate "placeholder" step for a simpler transition
      tl.to(newSpan, {
        duration: scrambleDuration,
        ease: "power2.out",
        scrambleText: {
          text: newTxt,
          chars: scrambleNoise,
          speed: 0.2,
          tweenLength: true,
          revealDelay: 0,
        },
      });
    } else {
      // INITIAL SEQUENCE: Fade In -> New
      tl.to(newSpan, {
        opacity: 1,
        duration: scrambleDuration,
        ease: "power2.out",
        scrambleText: {
          text: newTxt,
          chars: scrambleNoise,
          speed: 0.2,
          tweenLength: true,
          revealDelay: 0.1,
        },
      });
    }
  }, container);

  // Save context for future cleanup
  activeContexts.set(container, ctx);
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
