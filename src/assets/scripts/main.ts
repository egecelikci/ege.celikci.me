import { initLazyLoad } from "./common/lazyload.ts";

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

  // Lazy-load PhotoSwipe Lightbox

  const lightboxTriggers = document.querySelector(
    "[data-litebox-group], .litebox-trigger, .markdown img",
  );
  if (lightboxTriggers) {
    // Only import and init when user is likely to interact
    const loadLightbox = async () => {
      const { initLightbox } = await import("./common/lightbox.ts");
      initLightbox();
    };

    // Use interaction hints to pre-load
    window.addEventListener("mouseover", loadLightbox, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", loadLightbox, {
      once: true,
      passive: true,
    });
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
