import gsap from "npm:gsap@^3.14.1";
import ScrambleTextPlugin from "npm:gsap@^3.14.1/ScrambleTextPlugin";

try {
  gsap.registerPlugin(ScrambleTextPlugin,);
} catch (e) {
  console.warn("GSAP ScrambleTextPlugin failed to register:", e,);
}

const CONFIG = {
  baseInterval: 3000,
  maxInterval: 120000,
  backoffFactor: 1.5,
};

const activeContexts = new WeakMap<Element, gsap.Context>();
const pendingTransitions = new WeakMap<Element, number>();

let currentInterval = CONFIG.baseInterval;
let pollTimeout: number | null = null;
let abortController: AbortController | null = null;

/**
 * Updates the visual state classes.
 * FIX: Now explicitly removes 'is-changing' to prevent stuck states.
 */
function setStatusState(
  type: "loading" | "error" | "active" | "inactive" | "clear",
  container?: HTMLElement,
) {
  const targetItems = container
    ? [container,]
    : document.querySelectorAll(".status-dashboard > div",);

  targetItems.forEach((item,) => {
    if (!item) return;
    // CRITICAL FIX: Ensure 'is-changing' is removed when setting a new stable state
    item.classList.remove(
      "is-loading",
      "is-error",
      "is-active",
      "is-inactive",
      "is-changing",
    );
    if (type !== "clear") {
      item.classList.add(`is-${type}`,);
    }
  },);
}

function createMarqueeAnimation(element: HTMLElement,) {
  const container = element.parentElement;
  if (!container) return;

  requestAnimationFrame(() => {
    const scrollWidth = element.scrollWidth;
    const clientWidth = container.clientWidth;

    if (scrollWidth <= clientWidth) return;

    const gap = "    •    ";
    const originalHTML = element.innerHTML;

    element.innerHTML = `<span>${originalHTML}${gap}</span>${originalHTML}`;
    const span = element.firstElementChild as HTMLElement;
    const offset = span ? span.offsetWidth : 0;
    element.innerHTML = originalHTML + gap + originalHTML;

    const tl = gsap.to(element, {
      x: -offset,
      duration: offset / 50,
      ease: "none",
      repeat: -1,
      paused: false,
    },);

    container.onmouseenter = () => tl.pause();
    container.onmouseleave = () => tl.play();
  },);
}

async function loadStatus() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  const hasData = document.querySelector(
    ".status-dashboard div.is-active, .status-dashboard div.is-inactive",
  );
  if (!hasData) setStatusState("loading",);

  try {
    const res = await fetch("/api/status", {
      signal: abortController.signal,
    },);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`,);

    currentInterval = CONFIG.baseInterval;
    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value, } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true, },);
      const parts = buffer.split("\n",);
      buffer = parts.pop() || "";
      for (const part of parts) if (part.trim()) processChunk(part,);
    }
    if (buffer.trim()) processChunk(buffer,);
  } catch (err: any) {
    if (err.name === "AbortError") return;
    setStatusState("error",);
    currentInterval = Math.min(
      currentInterval * CONFIG.backoffFactor,
      CONFIG.maxInterval,
    );
  } finally {
    if (document.visibilityState === "visible") {
      pollTimeout = setTimeout(loadStatus, currentInterval,);
    }
  }
}

function processChunk(htmlString: string,) {
  const temp = document.createElement("div",);
  temp.innerHTML = htmlString;
  const newData = temp.firstElementChild as HTMLElement;

  if (!newData) return;

  const targetId = {
    "music-status": "#music-status-container",
    "game-status": "#game-status-container",
    "manga-status": "#manga-status-container",
  }[newData.id];

  if (!targetId) return;

  const container = document.querySelector(targetId,) as HTMLElement;
  if (container) {
    updateSingleUI(container, newData,);
  }
}

function updateSingleUI(container: HTMLElement, newData: HTMLElement,) {
  container.hidden = false;

  const getTxt = (el: Element | null,) => {
    if (!el) return "";
    const s = el.querySelector("span[data-status]",)
      || el.querySelector(".text-text",);
    return s?.getAttribute("data-status",) || s?.textContent?.trim() || "";
  };

  const getActiveState = (el: Element | null,) => {
    const s = el?.querySelector("span[data-status]",)
      || el?.querySelector(".text-text",);
    return s?.getAttribute("data-active",) === "true";
  };

  const newTxt = getTxt(newData,);
  const curTxt = getTxt(container,);

  const newState = getActiveState(newData,);
  const curState = container.classList.contains("is-active",);

  if (newTxt === curTxt && newState === curState && curTxt !== "") return;

  if (curTxt && curTxt !== "" && !pendingTransitions.has(container,)) {
    container.classList.add("is-changing",);

    const timeoutId = window.setTimeout(() => {
      container.classList.remove("is-changing",);
      pendingTransitions.delete(container,);
      performUpdate(container, newData, newTxt, curTxt,);
    }, 1000,);

    pendingTransitions.set(container, timeoutId,);
    return;
  }

  if (pendingTransitions.has(container,)) return;

  performUpdate(container, newData, newTxt, curTxt,);
}

function performUpdate(
  container: HTMLElement,
  newData: HTMLElement,
  newTxt: string,
  curTxt: string,
) {
  // 1. Determine State
  // We check for the span, but default to 'inactive' if missing to avoid crashes
  const newSpan = newData.querySelector("span",);
  const isActive = newSpan?.getAttribute("data-active",) === "true";

  // 2. Apply State (This removes is-changing and applies is-active/inactive)
  setStatusState(isActive ? "active" : "inactive", container,);

  if (activeContexts.has(container,)) {
    activeContexts.get(container,)?.revert();
  }

  const richHTML = newSpan?.innerHTML || "";
  const placeholderChar = newSpan?.dataset.chars || "█";
  const scrambleNoise = placeholderChar;
  const scrambleDuration = 1 + newTxt.length * 0.03;

  // 3. Update DOM Content
  container.setAttribute("aria-label", newTxt,);

  const textWrapper = container.querySelector(".overflow-hidden.grow",);

  if (textWrapper && newSpan) {
    const oldSpan = textWrapper.querySelector(".text-text",);
    if (oldSpan) oldSpan.remove();

    newSpan.classList.add("inline-block", "whitespace-nowrap", "text-text",);
    textWrapper.appendChild(newSpan,);
  }

  if (activeContexts.has(container,)) {
    const oldCtx = activeContexts.get(container,);
    oldCtx?.revert();
  }

  // 4. Run Animation
  const ctx = gsap.context(() => {
    // We target the newSpan we just appended
    const targetSpan = newSpan;
    if (!targetSpan) return;

    gsap.set(targetSpan, {
      opacity: curTxt ? 1 : 0,
      y: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "block",
      maxWidth: "100%",
    },);

    const tl = gsap.timeline({
      delay: 0,
      onComplete: () => {
        ctx.add(() => {
          targetSpan.dataset.unscrambled = "true";
          gsap.set(targetSpan, {
            overflow: "visible",
            textOverflow: "clip",
            maxWidth: "none",
          },);
          targetSpan.innerHTML = richHTML;
          createMarqueeAnimation(targetSpan,);
        },);
      },
    },);

    const hasPlugin = gsap.plugins?.scrambleText;

    if (curTxt && hasPlugin) {
      tl.to(targetSpan, {
        duration: scrambleDuration,
        ease: "power2.out",
        scrambleText: {
          text: newTxt,
          chars: scrambleNoise,
          speed: 0.2,
          tweenLength: true,
          revealDelay: 0,
        },
      },);
    } else {
      tl.to(targetSpan, {
        opacity: 1,
        duration: scrambleDuration,
        ease: "power2.out",
        onStart: () => {
          targetSpan.textContent = newTxt;
        },
      },);
    }
  }, container,);

  activeContexts.set(container, ctx,);
}

loadStatus();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (pollTimeout) clearTimeout(pollTimeout,);
    currentInterval = CONFIG.baseInterval;
    loadStatus();
  } else {
    if (pollTimeout) clearTimeout(pollTimeout,);
    if (abortController) abortController.abort();
  }
},);

export { loadStatus, };
