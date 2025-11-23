// Module Preload
import "vite/modulepreload-polyfill";

// Main Stylesheet
import "../styles/main.scss";

// Common Modules
import "./common/lazyload";
import "./common/preload";
import "./common/register-serviceworker";
import "./common/speedlify";
import "./status.js";

//
if (document.querySelector(".album")) {
  import("./grid.js");
}

//
if (document.querySelector(".link-list--status")) {
  import("./status.js");
}
