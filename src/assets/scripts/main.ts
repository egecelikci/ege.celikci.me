import { animateGridItems, } from "./common/grid.ts";

import "./common/lazyload.ts";
import "./common/lightbox.ts";
import "./common/preload.ts";
import "./common/register-serviceworker.ts";

const albumItems = document.querySelectorAll(".album-item",);
if (albumItems.length) {
  requestAnimationFrame(() => animateGridItems(albumItems,));
}

if (document.querySelector(".link-list--status",)) {
  import("./status.ts");
}
