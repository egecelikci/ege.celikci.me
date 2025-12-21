// Always load critical/small logic immediately
import { animateGridItems } from "./common/grid.ts";

async function init() {
  animateGridItems(".album-item");

  if (document.querySelector("[data-pswp-gallery]")) {
    const { initPhotoSwipe } = await import("./common/lightbox.ts");
    initPhotoSwipe();
  }

  if (document.querySelector(".status-dashboard")) {
    const { loadStatus } = await import("./status.ts");
    loadStatus();
  }

  const { initLazyLoad } = await import("./common/lazyload.ts");
  initLazyLoad();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}