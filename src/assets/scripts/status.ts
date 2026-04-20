import gsap from "gsap";
import ScrambleTextPlugin from "gsap/ScrambleTextPlugin";
import { initAuthModal, signWithPasskey, } from "./admin.ts";

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
try {
  initAuthModal();
} catch (e) {
  console.error("Auth modal init failed:", e,);
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
    : document.querySelectorAll(".status-dashboard > div > div",); // Fixed selector to target the StatusItem root

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

function initScrollInteractions() {
  const container = document.getElementById("status-scroll-container",);
  const dots = document.querySelectorAll(".status-dot",);
  if (!container || dots.length === 0) return;

  // 1. Sync dots with scroll
  container.addEventListener("scroll", () => {
    const scrollLeft = container.scrollLeft;
    const width = container.offsetWidth;
    const index = Math.round(scrollLeft / width,);

    dots.forEach((dot, i,) => {
      dot.setAttribute("aria-current", i === index ? "true" : "false",);
    },);
  }, { passive: true, },);

  // 2. Click dots to scroll
  dots.forEach((dot, i,) => {
    dot.addEventListener("click", () => {
      const width = container.offsetWidth;
      container.scrollTo({
        left: width * i,
        behavior: "smooth",
      },);
    },);
  },);

  // 3. Intro Peek Animation (Mobile Only)
  if (!hasPeeked && window.innerWidth < 768) {
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

  // Allow update if text, state, liked status, or MBID changed
  if (
    newTxt === curTxt
    && newState === curState
    && newLiked === curLiked
    && newMbid === curMbid
    && newIsMsid === curIsMsid
    && curTxt !== ""
  ) return;

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
  const isMsid = newSpan?.getAttribute("data-is-msid",) === "true";

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
      const heartIcon = likeBtn.querySelector("svg",);

      const updateLikeUI = (liked: boolean, animate = false,) => {
        if (!heartIcon) return;

        const elements = [heartIcon, ...heartIcon.querySelectorAll("path",),];

        if (animate) {
          // Playful pop animation
          gsap.to(likeBtn, {
            scale: 1.3,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "back.out(2)",
            onStart: () => {
              if (liked) {
                heartIcon.classList.add("fill-primary",);
                heartIcon.classList.remove("fill-none",);
                elements.forEach(el =>
                  el.setAttribute("fill", "currentColor",)
                );
              } else {
                heartIcon.classList.add("fill-none",);
                heartIcon.classList.remove("fill-primary",);
                elements.forEach(el => el.setAttribute("fill", "none",));
              }
            },
          },);
        } else {
          // Silent update
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
        heartIcon.classList.add("text-primary",);
      };

      // Set initial state from data
      updateLikeUI(isLiked, !!curTxt,);

      // Smooth reveal of the like widget
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

      likeBtn.onclick = async (e,) => {
        e.preventDefault();
        e.stopPropagation();

        const currentLiked = newSpan?.getAttribute("data-liked",) === "true";
        likeBtn.classList.add("animate-pulse",);

        try {
          const token = localStorage.getItem("status_owner_token",);
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          } else if (
            localStorage.getItem("status_owner_verified",) === "true"
          ) {
            try {
              const assertion = await signWithPasskey(
                "authorize-like-" + mbid,
              );
              if (assertion) {
                headers["X-Passkey-Assertion"] = JSON.stringify(assertion,);
              }
            } catch (err) {
              console.warn("Passkey assertion failed or cancelled", err,);
              document.getElementById("status-auth-trigger",)?.click();
              return;
            }
          } else {
            document.getElementById("status-auth-trigger",)?.click();
            return;
          }

          const res = await fetch("/api/like", {
            method: "POST",
            headers,
            body: JSON.stringify({ mbid, liked: !currentLiked, isMsid, },),
          },);

          if (res.ok) {
            const data = await res.json();
            const nowLiked = data.score === 1;
            updateLikeUI(nowLiked, true,);
            newSpan?.setAttribute("data-liked", String(nowLiked,),);
          } else if (res.status === 401) {
            localStorage.removeItem("status_owner_verified",);
            document.getElementById("status-auth-trigger",)?.click();
          }
        } catch (err) {
          console.error("Like failed:", err,);
        } finally {
          likeBtn.classList.remove("animate-pulse",);
        }
      };
    } else {
      // Hide with animation
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
