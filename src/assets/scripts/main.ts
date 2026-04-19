import { initLazyLoad, } from "./common/lazyload.ts";

async function init() {
  initLazyLoad();

  const albumItems = document.querySelector(".album-item",);
  if (albumItems && !document.body.dataset.disableAnimation) {
    const { animateGridItems, } = await import("./common/grid.ts");
    animateGridItems(".album-item",);

    const { initTouchReveal, } = await import("./common/touch.ts");
    initTouchReveal(".album-item",);
  }

  if (document.querySelector("[data-pswp-gallery]",)) {
    const { initPhotoSwipe, } = await import("./common/lightbox.ts");
    initPhotoSwipe();
  }

  if (document.querySelector(".status-dashboard",)) {
    const { loadStatus, } = await import("./status.ts");
    loadStatus();
  }
}

// Global execution check
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init,);
} else {
  init();
}
