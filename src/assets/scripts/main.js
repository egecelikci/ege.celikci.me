// Module Preload
import "vite/modulepreload-polyfill";

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
// CHANGE: Named import so we can use the function explicitly
import { animateGridItems } from "./common/grid";

import "./common/infinitescroll";
import "./common/lazyload";
import "./common/preload";
import "./common/register-serviceworker";
import "./common/speedlify";
import "./common/lightbox";
import "./common/notes-view";

// --- Page Specific Logic ---

// 1. Music Page Grid
// We check if the elements exist before running the animation logic
const albumItems = document.querySelectorAll(".album__item");
if (albumItems.length) {
  // Use requestAnimationFrame to ensure DOM is painted before animating
  requestAnimationFrame(() => animateGridItems(albumItems));
}

// 2. Status Links
if (document.querySelector(".link-list--status")) {
  import("./status");
}
