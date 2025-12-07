/// <reference lib="dom" />

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
// CHANGE: Named import so we can use the function explicitly
import { animateGridItems, } from "./common/grid.ts";

import "./common/lazycolor.ts";
import "./common/infinitescroll.ts";
import "./common/lazyload.ts";
import "./common/lightbox.ts";
import "./common/notes-view.ts";
import "./common/preload.ts";
import "./common/register-serviceworker.ts";
import "./common/speedlify.ts";

// --- Page Specific Logic ---

// 1. Music Page Grid
// We check if the elements exist before running the animation logic
const albumItems = document.querySelectorAll(".album__item",);
if (albumItems.length) {
  requestAnimationFrame(() => animateGridItems(albumItems,));
}
if (document.querySelector("#status",)) {
  import("./status.ts");
}

if (document.querySelector("#webmentions",)) {
  import("./webmentions.ts");
}
