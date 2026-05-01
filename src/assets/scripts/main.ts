import { initLazyLoad } from "./common/lazyload.ts";

async function init() {
  initLazyLoad();

  // Service Worker Registration
  if (process.env.MODE === "production") {
    await import("./common/register-serviceworker.ts");
  }

  const albumItems = document.querySelector(
    ".album-item, .collage-item, .h-entry",
  );
  if (albumItems && !document.body.dataset.disableAnimation) {
    const { animateGridItems } = await import("./common/grid.ts");
    animateGridItems(".album-item");

    const { initTouchReveal } = await import("./common/touch.ts");
    initTouchReveal(".album-item, .collage-item, .h-entry");
  }

  // PhotoSwipe Lightbox
  const { initLightbox } = await import("./common/lightbox.ts");
  initLightbox();

  // Venue Maps (Leaflet)
  if (document.querySelector(".venue-map")) {
    const { initVenueMaps } = await import("./common/map.ts");
    initVenueMaps();
  }

  if (document.querySelector(".status-dashboard")) {
    const { loadStatus } = await import("./status.ts");
    loadStatus();
  }
}

// Global execution check
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
