import { initLazyLoad } from "./common/lazyload.ts";

// ─── Lightbox Lazy Loading & Interception ──────────────────────────────────

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

// Use interaction hints to pre-load
window.addEventListener("mouseover", () => loadLightbox(), {
  once: true,
  passive: true,
});
window.addEventListener("touchstart", () => loadLightbox(), {
  once: true,
  passive: true,
});

// Intercept click to ensure lightbox is ready
// This must be at top-level to catch clicks as early as possible
window.addEventListener(
  "click",
  async (e) => {
    // Only intercept left clicks without modifiers
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    if (isLightboxReady) return;

    const target = e.target as HTMLElement;
    // Precisely match elements PhotoSwipe is configured to handle in lightbox.ts
    const trigger = target.closest(
      "a.litebox-trigger, .markdown img, [data-litebox-group] img",
    );

    if (trigger) {
      // Stop the browser from following the link or opening the image
      e.preventDefault();
      e.stopImmediatePropagation();

      await loadLightbox();

      // Re-trigger the click now that lightbox is ready
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

// ─── Main Init ──────────────────────────────────────────────────────────────

async function init() {
  initLazyLoad();

  // Service Worker Registration
  if (process.env.MODE === "production") {
    await import("./common/register-serviceworker.ts");
  }

  const revealItems = document.querySelector(
    ".album-item, .collage-item, .h-entry",
  );
  if (revealItems && !document.body.dataset.disableAnimation) {
    const { initTouchReveal } = await import("./common/touch.ts");
    initTouchReveal(".album-item, .collage-item, .h-entry");
  }

  // Venue Maps (Leaflet)
  if (document.querySelector(".venue-map")) {
    const { initVenueMaps } = await import("./common/map.ts");
    initVenueMaps();
  }
}

// Global execution check
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
