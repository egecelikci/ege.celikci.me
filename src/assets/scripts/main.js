// Module Preload
import "vite/modulepreload-polyfill";

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
import "./common/grid";
import "./common/infinitescroll";
import "./common/lazyload";
import "./common/preload";
import "./common/register-serviceworker";
import "./common/speedlify";
import "./common/lightbox";
import "./common/notes-view";

// Status Links
if (document.querySelector(".link-list--status")) {
  import("./status");
}
