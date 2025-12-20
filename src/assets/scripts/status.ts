import gsap from "npm:gsap@^3.14.1";
import ScrambleTextPlugin from "npm:gsap@^3.14.1/ScrambleTextPlugin";

gsap.registerPlugin(ScrambleTextPlugin,);

const CONFIG = {
  baseInterval: 3000,
  maxInterval: 120000,
  backoffFactor: 1.5,
};

const STATUS_ORDER = ["music-status", "game-status", "manga-status",];
const activeContexts = new WeakMap<Element, gsap.Context>();
const pendingTransitions = new WeakMap<Element, number>();

let currentInterval = CONFIG.baseInterval;
let pollTimeout: number | null = null;
let abortController: AbortController | null = null;

function setStatusState(
  type: "loading" | "error" | "active" | "inactive" | "clear",
  container?: HTMLElement,
) {
  const targetItems = container
    ? [container.closest("li",),]
    : document.querySelectorAll(".link-list--status > li",);

  targetItems.forEach((li,) => {
    if (!li) return;
    li.classList.remove("is-loading", "is-error", "is-active", "is-inactive",);
    if (type !== "clear") {
      li.classList.add(`is-${type}`,);
    }
  },);
}

function createMarqueeAnimation(element: HTMLElement,) {
  const wrapper = element.parentElement;
  if (!wrapper || element.scrollWidth <= wrapper.clientWidth) return;

  const spacer = "&nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp;";
  const originalContent = element.innerHTML;
  element.innerHTML =
    `<span>${originalContent}${spacer}</span>${originalContent}`;

  const firstChild = element.firstElementChild as HTMLElement;
  const distance = firstChild ? firstChild.offsetWidth : 0;
  element.innerHTML = originalContent + spacer + originalContent;

  const marqueeTween = gsap.to(element, {
    x: -distance,
    duration: distance / 50,
    ease: "none",
    repeat: -1,
  },);

  const pause = () => marqueeTween.pause();
  const play = () => marqueeTween.play();

  wrapper.onmouseenter = pause;
  wrapper.onmouseleave = play;
  wrapper.ontouchstart = () => pause();
  wrapper.ontouchend = play;
  wrapper.ontouchcancel = play;
}

async function loadStatus() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  const hasData = document.querySelector(
    ".link-list--status li.is-active, .link-list--status li.is-inactive",
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
  const newElement = temp.firstElementChild as HTMLElement;
  if (!newElement) return;

  const id = newElement.id;
  const mapping: Record<string, string> = {
    "music-status": "#music-status-container",
    "game-status": "#game-status-container",
    "manga-status": "#manga-status-container",
  };

  const containerSelector = mapping[id];
  if (!containerSelector) return;
  const placeholder = document.querySelector(containerSelector,);
  if (placeholder) updateSingleUI(placeholder as HTMLElement, newElement,);
}

function updateSingleUI(container: HTMLElement, newData: HTMLElement,) {
  const li = container.closest("li",);
  if (!li) return;
  li.hidden = false;

  const currentInner = container.querySelector(`[id="${newData.id}"]`,);

  const getTxt = (el: Element | null,) => {
    const s = el?.querySelector("span",);
    return s?.dataset.status || s?.textContent || "";
  };

  const newTxt = getTxt(newData,);
  const curTxt = getTxt(currentInner,);

  if (newTxt === curTxt && curTxt !== "") return;

  if (curTxt && curTxt !== "" && !pendingTransitions.has(container,)) {
    li.classList.add("is-changing",);

    const timeoutId = setTimeout(() => {
      li.classList.remove("is-changing",);
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
  const newSpan = newData.querySelector("span",);

  if (newSpan) {
    const isActive = newSpan.dataset.active === "true";
    setStatusState(isActive ? "active" : "inactive", container,);
  }

  if (activeContexts.has(container,)) {
    activeContexts.get(container,)?.revert();
  }

  const richHTML = newSpan?.innerHTML || "";
  const placeholderChar = newSpan?.dataset.chars || "█";
  const scrambleNoise = placeholderChar;

  const dynamicDelay = 0;
  const scrambleDuration = 1 + newTxt.length * 0.03;

  container.setAttribute("aria-label", newTxt,);
  container.innerHTML = "";
  container.appendChild(newData,);

  const ctx = gsap.context(() => {
    const targetSpan = container.querySelector("span",);
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
      delay: dynamicDelay,
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

    if (curTxt) {
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
        scrambleText: {
          text: newTxt,
          chars: scrambleNoise,
          speed: 0.2,
          tweenLength: true,
          revealDelay: 0.1,
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
