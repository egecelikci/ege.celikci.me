import { initLazyLoad } from "./common/lazyload.ts";

let loadingPromise: Promise<void> | null = null;
let isLightboxReady = false;

const loadLightbox = async () => {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const { initLightbox } = await import("./common/lightbox.ts");
    initLightbox();
    isLightboxReady = true;
  })();
  return loadingPromise;
};

window.addEventListener("mouseover", () => loadLightbox(), {
  once: true,
  passive: true,
});

window.addEventListener("touchstart", () => loadLightbox(), {
  once: true,
  passive: true,
});

window.addEventListener(
  "click",
  async (e) => {
    if (e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }

    if (isLightboxReady) return;

    const target = e.target as HTMLElement;
    const trigger = target.closest(
      "a.lightbox-trigger, .markdown img, [data-lightbox-group] img",
    );

    if (trigger) {
      e.preventDefault();
      e.stopImmediatePropagation();

      await loadLightbox();

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
  initLazyLoad();

  document.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(
      ".video-card[data-embed]",
    );
    if (!card) return;
    card.innerHTML = card.dataset.embed || "";
  });
  // Disclosure popovers (external-links, map directions): native <details>,
  // one open at a time, close on outside click / Escape, card clamped to
  // the viewport. (The card is anchored absolutely; see the removed
  // view-transition-name on .event-page__content to keep it above the
  // sticky sidebar.)
  const POPOVER_SELECTOR =
    "details.external-links__more, details.event-page__map-nav";
  const closePopovers = () => {
    document.querySelectorAll(`${POPOVER_SELECTOR}[open]`).forEach(
      (el) => (el as HTMLDetailsElement).removeAttribute("open"),
    );
  };
  const clampPopover = (details: HTMLDetailsElement) => {
    const card = details.querySelector<HTMLElement>(
      details.matches("details.external-links__more")
        ? ".external-links__rows"
        : ".event-page__map-menu",
    );
    const offsetParent = card?.offsetParent as HTMLElement | null;
    if (!card || !offsetParent) return;
    const pad = 8;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const rect = card.getBoundingClientRect();
    const parentRect = offsetParent.getBoundingClientRect();
    let left = rect.left;
    if (rect.right > vw - pad) left = vw - pad - rect.width;
    if (left < pad) left = pad;
    card.style.left = `${left - parentRect.left}px`;
    card.style.right = "auto";
    if (
      details.matches("details.external-links__more") &&
      rect.bottom > vh - pad
    ) {
      card.style.top = "auto";
      card.style.bottom = "calc(100% + 0.5rem)";
    }
  };
  // toggle does not bubble — listen in capture phase
  document.addEventListener(
    "toggle",
    (e) => {
      const details = e.target as HTMLDetailsElement;
      if (!details.matches(POPOVER_SELECTOR)) return;
      if (details.open) {
        document.querySelectorAll(`${POPOVER_SELECTOR}[open]`).forEach(
          (el) => {
            if (el !== details) {
              (el as HTMLDetailsElement).removeAttribute("open");
            }
          },
        );
        requestAnimationFrame(() => {
          if (details.open) clampPopover(details);
        });
      }
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(POPOVER_SELECTOR)) return;
    closePopovers();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopovers();
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll(`${POPOVER_SELECTOR}[open]`).forEach(
      (el) => clampPopover(el as HTMLDetailsElement),
    );
  });

  if (process.env.MODE === "production") {
    await import("./common/register-serviceworker.ts");
  }

  const revealItems = document.querySelector(
    ".album-item, .h-entry",
  );

  if (revealItems && !document.body.dataset.disableAnimation) {
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
