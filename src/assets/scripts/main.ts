import { initLazyLoad } from "./common/lazyload.ts";

let loadingPromise: Promise<void> | null = null;
let isLightboxReady = false;

const loadLightbox = async () => {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const { initLightbox } = await import("./common/lightbox.ts");
    initLightbox();
    isLightboxReady = true;
  })();
  return loadingPromise;
};

window.addEventListener("mouseover", () => loadLightbox(), {
  once: true,
  passive: true,
});

window.addEventListener("touchstart", () => loadLightbox(), {
  once: true,
  passive: true,
});

window.addEventListener(
  "click",
  async (e) => {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    if (isLightboxReady) return;

    const target = e.target as HTMLElement;
    const trigger = target.closest(
      "a.lightbox-trigger, .markdown img, [data-lightbox-group] img",
    );

    if (trigger) {
      e.preventDefault();
      e.stopImmediatePropagation();

      await loadLightbox();

      trigger.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  },
  { capture: true },
);

async function init() {
  initLazyLoad();

  if (process.env.MODE === "production") {
    await import("./common/register-serviceworker.ts");
  }

  const revealItems = document.querySelector(
    ".album-item, .h-entry",
  );

  if (revealItems && !document.body.dataset.disableAnimation) {
    const { initTouchReveal } = await import("./common/touch.ts");
    initTouchReveal(".album-item, .h-entry");
  }

  if (document.querySelector("[data-search-id]")) {
    const { initSearch } = await import("./common/search.ts");
    initSearch();
  }

  if (document.getElementById("coffee-input")) {
    const { initBrewCalculator } = await import("./common/brew-calculator.ts");
    initBrewCalculator();
  }

  const collageRoot = document.querySelector(
    "[data-collage-tool]",
  ) as HTMLElement;
  if (collageRoot) {
    const { initCollageTool } = await import("./common/collage-tool.ts");
    initCollageTool(collageRoot.dataset.defaultUsername || "");
  }

  if (document.querySelector(".venue-map")) {
    const { initVenueMaps } = await import("./common/map.ts");
    initVenueMaps();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
