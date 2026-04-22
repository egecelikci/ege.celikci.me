import gsap from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";
import {
  initAuthModal,
  isSessionValid,
  openAuthModal,
  signWithPasskey,
} from "./admin.ts";

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
let hasPeeked = false;

// Initialize Auth
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initAuthModal();
  },);
} else {
  initAuthModal();
}

/**
 * Updates the visual state classes.
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

/**
 * Shared Like UI logic
 */
function updateLikeUI(
  container: HTMLElement,
  liked: boolean,
  animate = false,
) {
  const likeBtn = container.querySelector(
    ".status-like-button",
  ) as HTMLElement;
  const heartIcon = likeBtn?.querySelector("svg",);
  if (!heartIcon) return;

  const elements = [heartIcon, ...heartIcon.querySelectorAll("path",),];

  if (animate) {
    const tl = gsap.timeline();

    // Playful scale & fill animation
    tl.to(likeBtn, {
      scale: 1.4,
      duration: 0.15,
      ease: "power2.out",
    },);

    tl.add(() => {
      if (liked) {
        heartIcon.classList.add("fill-primary",);
        heartIcon.classList.remove("fill-none",);
        elements.forEach(el => el.setAttribute("fill", "currentColor",));
      } else {
        heartIcon.classList.add("fill-none",);
        heartIcon.classList.remove("fill-primary",);
        elements.forEach(el => el.setAttribute("fill", "none",));
      }
    },);

    tl.to(likeBtn, {
      scale: 1,
      duration: 0.4,
      ease: "back.out(3)",
    },);
  } else {
    // Immediate state set
    if (liked) {
      heartIcon.classList.add("fill-primary",);
      heartIcon.classList.remove("fill-none",);
      elements.forEach(el => el.setAttribute("fill", "currentColor",));
    } else {
      heartIcon.classList.add("fill-none",);
      heartIcon.classList.remove("fill-primary",);
      elements.forEach(el => el.setAttribute("fill", "none",));
    }
  }
}

/**
 * --- EVENT DELEGATION (Reliable interaction) ---
 */
function initGlobalInteractions() {
  document.addEventListener("click", async (e,) => {
    const target = e.target as HTMLElement;

    // 2. Like Button -> Handle Like
    const likeBtn = target.closest(".status-like-button",) as HTMLElement;
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();

      const container = likeBtn.closest(
        "[id$='-status-container']",
      ) as HTMLElement;
      const dataSpan = container?.querySelector("span[data-status]",);
      if (!container || !dataSpan) return;

      const mbid = dataSpan.getAttribute("data-mbid",);
      const isMsid = dataSpan.getAttribute("data-is-msid",) === "true";
      const currentLiked = dataSpan.getAttribute("data-liked",) === "true";

      if (!mbid) return;

      const performLike = async () => {
        // UX: Visual feedback - "Panic" while loading
        container.classList.add("is-changing",);
        likeBtn.classList.add("animate-pulse",);

        try {
          const token = localStorage.getItem("status_owner_token",);
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          } else {
            // One-time signature for this specific like intent
            try {
              const assertion = await signWithPasskey(
                "authorize-like-" + mbid,
              );
              if (assertion) {
                headers["X-Passkey-Assertion"] = JSON.stringify(assertion,);
              }
            } catch (err: any) {
              console.warn("[auth] Passkey assertion failed", err,);
              container.classList.remove("is-changing",);
              if (err.name !== "NotAllowedError") {
                openAuthModal(performLike,);
              }
              return;
            }
          }

          const res = await fetch("/api/like", {
            method: "POST",
            headers,
            body: JSON.stringify({ mbid, liked: !currentLiked, isMsid, },),
          },);

          if (res.ok) {
            loadStatus();
          } else if (res.status === 401) {
            localStorage.removeItem("status_owner_verified",);
            localStorage.removeItem("status_session_expiry",);
            container.classList.remove("is-changing",);
            openAuthModal(performLike,);
          } else {
            container.classList.remove("is-changing",);
          }
        } catch (err) {
          console.error("[Status] Like failed:", err,);
          container.classList.remove("is-changing",);
        } finally {
          likeBtn.classList.remove("animate-pulse",);
        }
      };

      // Identity Recognition Check
      if (!isSessionValid()) {
        openAuthModal(performLike,);
        return;
      }

      // If already verified, perform immediately
      performLike();
    }
  },);
}

function initScrollInteractions() {
  const container = document.getElementById("status-scroll-container",);
  const dots = document.querySelectorAll(".status-dot",);
  if (!container || dots.length === 0) return;

  container.addEventListener("scroll", () => {
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const index = Math.round(scrollLeft / width,);

    dots.forEach((dot, i,) => {
      dot.setAttribute("aria-current", i === index ? "true" : "false",);
    },);
  }, { passive: true, },);

  dots.forEach((dot, i,) => {
    dot.addEventListener("click", () => {
      const width = container.offsetWidth;
      container.scrollTo({
        left: width * i,
        behavior: "smooth",
      },);
    },);
  },);

  if (!hasPeeked && globalThis.innerWidth < 768) {
    hasPeeked = true;
    setTimeout(() => {
      gsap.to(container, {
        scrollLeft: 60,
        duration: 0.6,
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1,
        delay: 1,
      },);
    }, 1000,);
  }
}

async function loadStatus() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

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
    console.error("Status Load Error:", err,);
    setStatusState("error",);
    currentInterval = Math.min(
      currentInterval * CONFIG.backoffFactor,
      CONFIG.maxInterval,
    );
  } finally {
    if (document.visibilityState === "visible") {
      if (pollTimeout) clearTimeout(pollTimeout,);
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

  const getLikedState = (el: Element | null,) => {
    const s = el?.querySelector("span[data-status]",)
      || el?.querySelector(".text-text",);
    return s?.getAttribute("data-liked",) === "true";
  };

  const getMbid = (el: Element | null,) => {
    const s = el?.querySelector("span[data-status]",)
      || el?.querySelector(".text-text",);
    return s?.getAttribute("data-mbid",) || "";
  };

  const getIsMsid = (el: Element | null,) => {
    const s = el?.querySelector("span[data-status]",)
      || el?.querySelector(".text-text",);
    return s?.getAttribute("data-is-msid",) === "true";
  };

  const newTxt = getTxt(newData,);
  const curTxt = getTxt(container,);

  const newState = getActiveState(newData,);
  const curState = container.classList.contains("is-active",);

  const newLiked = getLikedState(newData,);
  const curLiked = getLikedState(container,);

  const newMbid = getMbid(newData,);
  const curMbid = getMbid(container,);

  const newIsMsid = getIsMsid(newData,);
  const curIsMsid = getIsMsid(container,);

  // Detect if only liked status changed for the SAME song
  const likedChangedOnly = newTxt === curTxt
    && newState === curState
    && newMbid === curMbid
    && newIsMsid === curIsMsid
    && newLiked !== curLiked;

  if (likedChangedOnly) {
    // Clear loading/panic state
    setStatusState(newState ? "active" : "inactive", container,);
    updateLikeUI(container, newLiked, true,);

    // Sync the local data-liked attribute
    const dataSpan = container.querySelector("span[data-status]",);
    if (dataSpan) dataSpan.setAttribute("data-liked", String(newLiked,),);
    return;
  }

  if (
    newTxt === curTxt
    && newState === curState
    && newLiked === curLiked
    && newMbid === curMbid
    && newIsMsid === curIsMsid
    && curTxt !== ""
  ) {
    // Even if no data changed, ensure we clear any lingering panic state from interaction
    if (container.classList.contains("is-changing",)) {
      setStatusState(curState ? "active" : "inactive", container,);
    }
    return;
  }

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
  const newSpan = newData.querySelector("span",);
  const isActive = newSpan?.getAttribute("data-active",) === "true";
  const mbid = newSpan?.getAttribute("data-mbid",);
  const isLiked = newSpan?.getAttribute("data-liked",) === "true";

  setStatusState(isActive ? "active" : "inactive", container,);

  if (activeContexts.has(container,)) {
    activeContexts.get(container,)?.revert();
  }

  const richHTML = newSpan?.innerHTML || "";
  const placeholderChar = newSpan?.dataset.chars || "×";
  const scrambleNoise = placeholderChar;
  const scrambleDuration = 1 + newTxt.length * 0.03;

  container.setAttribute("aria-label", newTxt,);

  const textWrapper = container.querySelector(".status-content-wrapper",);
  const actionWrapper = container.querySelector(
    ".status-action-wrapper",
  ) as HTMLElement;
  const likeBtn = container.querySelector(
    ".status-like-button",
  ) as HTMLElement;

  if (textWrapper && newSpan) {
    textWrapper.innerHTML = "";
    newSpan.classList.add("inline-block", "whitespace-nowrap",);
    textWrapper.appendChild(newSpan,);
  }

  if (actionWrapper && likeBtn) {
    if (mbid) {
      // Set initial like state without animation
      updateLikeUI(container, isLiked, false,);

      if (actionWrapper.classList.contains("hidden",)) {
        actionWrapper.classList.remove("hidden",);
        gsap.fromTo(actionWrapper, {
          opacity: 0,
          scale: 0.5,
          x: 20,
        }, {
          opacity: 1,
          scale: 1,
          x: 0,
          duration: 0.8,
          delay: scrambleDuration,
          ease: "back.out(2)",
        },);
      }
    } else {
      if (!actionWrapper.classList.contains("hidden",)) {
        gsap.to(actionWrapper, {
          opacity: 0,
          scale: 0.5,
          duration: 0.4,
          onComplete: () => actionWrapper.classList.add("hidden",),
        },);
      }
    }
  }

  const ctx = gsap.context(() => {
    const targetSpan = newSpan;
    if (!targetSpan) return;
    gsap.set(targetSpan, {
      opacity: curTxt ? 1 : 0,
      y: 0,
      whiteSpace: "nowrap",
      display: "inline-block",
      maxWidth: "100%",
    },);

    const tl = gsap.timeline({
      onComplete: () => {
        ctx.add(() => {
          targetSpan.dataset.unscrambled = "true";
          gsap.set(targetSpan, { maxWidth: "none", },);
          targetSpan.innerHTML = richHTML;
          createMarqueeAnimation(targetSpan,);
        },);
      },
    },);

    if (curTxt && gsap.plugins?.scrambleText) {
      tl.to(targetSpan, {
        duration: scrambleDuration,
        ease: "power2.out",
        scrambleText: {
          text: newTxt,
          chars: scrambleNoise,
          speed: 0.2,
          tweenLength: true,
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

// Global start
if (document.visibilityState === "visible") {
  loadStatus();
  initScrollInteractions();
  initGlobalInteractions();
}

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
