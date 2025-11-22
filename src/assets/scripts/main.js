// Module Preload
import "vite/modulepreload-polyfill";

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
import "./common/lazyload";
import "./common/preload";
import "./common/register-serviceworker";
import "./common/speedlify";
import "./common/status";

//
if (document.querySelector(".album")) {
  import("./music/grid.js");
}
