import { initSpoiler } from "./common/spoiler.ts";

let loadingPromise: Promise<void> | null = null;
let isLightboxReady = false;

/** Load the lightbox once; a failed import is forgotten so the next interaction can retry it. */
const loadLightbox = (): Promise<void> => {
  loadingPromise ??= import("./common/lightbox.ts")
    .then(({ initLightbox }) => {
      initLightbox();
      isLightboxReady = true;
    })
    .catch((error) => {
      loadingPromise = null;
      throw error;
    });
  return loadingPromise;
};

const preloadLightbox = () => loadLightbox().catch(() => {});

globalThis.addEventListener("mouseover", preloadLightbox, {
  once: true,
  passive: true,
});

globalThis.addEventListener("touchstart", preloadLightbox, {
  once: true,
  passive: true,
});

globalThis.addEventListener(
  "click",
  async (e) => {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    if (isLightboxReady) return;

    const target = e.target as HTMLElement;
    /**
     * Unrevealed spoiler tiles reveal in place; never preload the
     * lightbox for them (see common/spoiler.ts).
     */
    if (
      target.closest(
        ".media--spoiled:not(.is-revealed)",
      )
    ) {
      return;
    }
    const trigger = target.closest(
      "a.lightbox-trigger, .markdown img, [data-lightbox-group] img",
    );

    if (trigger) {
      e.preventDefault();
      e.stopImmediatePropagation();

      try {
        await loadLightbox();
      } catch {
        // Offline or a stale chunk after a deploy: fall back to opening the full image.
        const href = trigger.getAttribute("href") ??
          trigger.getAttribute("src");
        if (href) globalThis.location.assign(href);
        return;
      }

      trigger.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  },
  { capture: true },
);

async function init() {
  initSpoiler();

  document.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(
      ".video-card[data-embed-src]",
    );
    if (!card?.dataset.embedSrc) return;

    const iframe = document.createElement("iframe");
    iframe.className = "video-iframe";
    iframe.src = card.dataset.embedSrc;
    iframe.title = card.dataset.embedTitle || "video";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
    iframe.setAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-popups allow-forms",
    );
    iframe.allowFullscreen = true;

    // An iframe cannot live inside a button, so the player takes the card's place in a plain wrapper.
    const player = document.createElement("div");
    player.className = "video-card video-card--playing";
    player.append(iframe);
    card.replaceWith(player);
    iframe.focus();
  });
  /** Map directions popover: native <details>, closed on outside click or Escape. */
  const POPOVER_SELECTOR = "details.event-page__map-nav";
  const closePopovers = () => {
    document.querySelectorAll(`${POPOVER_SELECTOR}[open]`).forEach(
      (el) => (el as HTMLDetailsElement).removeAttribute("open"),
    );
  };
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(POPOVER_SELECTOR)) return;
    closePopovers();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopovers();
  });

  if (process.env.MODE === "production") {
    await import("./common/register-serviceworker.ts");
  }

  const revealItems = document.querySelector(
    ".album-item, .h-entry",
  );

  if (revealItems) {
    const { initTouchReveal } = await import("./common/touch.ts");
    initTouchReveal(".album-item, .h-entry");
  }

  if (document.querySelector("[data-search-id]")) {
    const { initSearch } = await import("./common/search.ts");
    initSearch();
  }

  if (document.getElementById("coffee-input")) {
    const { initBrewCalculator } = await import("./common/brew-calculator.ts");
    initBrewCalculator();
  }

  const collageRoot = document.querySelector(
    "[data-collage-tool]",
  ) as HTMLElement;
  if (collageRoot) {
    const { initCollageTool } = await import("./common/collage-tool.ts");
    initCollageTool(collageRoot.dataset.defaultUsername || "");
  }

  if (document.querySelector(".venue-map")) {
    const { initVenueMaps } = await import("./common/map.ts");
    initVenueMaps();
  }

  for (const rail of document.querySelectorAll<HTMLElement>(".rail")) {
    const { initRail } = await import("./common/rail.ts");
    initRail(rail);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
