// Module Preload
import "vite/modulepreload-polyfill";

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
// CHANGE: Named import so we can use the function explicitly
import { animateGridItems } from "./common/grid";

import "./common/infinitescroll";
import "./common/lazyload";
import "./common/lightbox";
import "./common/notes-view";
import "./common/preload";
import "./common/register-serviceworker";
import "./common/speedlify";

// --- Page Specific Logic ---

// 1. Music Page Grid
// We check if the elements exist before running the animation logic
const albumItems = document.querySelectorAll(".album__item");
if (albumItems.length) {
  requestAnimationFrame(() => animateGridItems(albumItems));
}
if (document.querySelector("#status")) {
  import("./status");
}

if (document.querySelector("#webmentions")) {
  import("./webmentions");
}
