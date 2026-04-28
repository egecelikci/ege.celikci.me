/**
 * lightbox.ts
 * PhotoSwipe 5 implementation with custom Phanpy-inspired UI.
 * Refined for PhotoSwipe 5 registerElement API, fixed null-checks, and added trackpad gestures.
 */

import PhotoSwipe from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PswpItem {
  src?: string;
  msrc?: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
  postUrl?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getTemplate = (id: string): HTMLElement | null => {
  const template = document.getElementById(id) as HTMLTemplateElement | null;
  if (!template) return null;
  return template.content.firstElementChild?.cloneNode(true) as HTMLElement;
};

const downloadMedia = async (src: string) => {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: src.split("/").pop() || "download",
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    window.open(src, "_blank");
  }
};

// ─── Main Init ───────────────────────────────────────────────────────────────

let isInitialized = false;

export function initLightbox() {
  if (isInitialized) return;
  console.log("[Lightbox] Initializing PhotoSwipe...");
  isInitialized = true;

  const lightbox = new PhotoSwipeLightbox({
    gallery: "[data-litebox-group], .markdown",
    children: "a.litebox-trigger, img:not(.litebox-trigger img)",
    pswpModule: PhotoSwipe,

    // Disable default UI
    zoom: false,
    close: false,
    counter: false,
    arrowPrev: false,
    arrowNext: false,

    // Gestures
    closeOnVerticalDrag: true,
    mouseMovePan: true,

    // Spacing to keep image between custom UI elements
    padding: { top: 120, bottom: 100, left: 20, right: 20 },
  });

  // 1. Data Parsing
  lightbox.addFilter("itemData", (itemData) => {
    const el = itemData.element;
    if (!el) return itemData;

    if (el.tagName === "A") {
      const anchor = el as HTMLAnchorElement;
      const img = anchor.querySelector("img");
      itemData.src = anchor.href;
      itemData.msrc = img?.src;
      itemData.alt = img?.alt || anchor.getAttribute("data-alt") || "";

      const w = anchor.getAttribute("data-pswp-width") ||
        img?.getAttribute("width");
      const h = anchor.getAttribute("data-pswp-height") ||
        img?.getAttribute("height");

      itemData.width = w ? parseInt(w, 10) : (img?.naturalWidth || 0);
      itemData.height = h ? parseInt(h, 10) : (img?.naturalHeight || 0);

      (itemData as any).postUrl = anchor.getAttribute("data-post-url");
      (itemData as any).mediaType = anchor.getAttribute("data-media-type") ||
        "image";
    } else if (el.tagName === "IMG") {
      const img = el as HTMLImageElement;
      itemData.src = img.src;
      itemData.msrc = img.src;
      itemData.alt = img.alt || "";
      itemData.width = parseInt(img.getAttribute("width") || "0", 10) ||
        img.naturalWidth || 0;
      itemData.height = parseInt(img.getAttribute("height") || "0", 10) ||
        img.naturalHeight || 0;
    }

    return itemData;
  });

  // 2. Video/Gifv Support
  lightbox.on("contentLoad", (e) => {
    const { content } = e;
    const data = content.data as any;
    if (data.mediaType === "video" || data.mediaType === "gifv") {
      e.preventDefault();
      const videoAttrs = data.mediaType === "gifv"
        ? "autoplay loop muted playsinline"
        : "controls";
      content.element = document.createElement("div");
      content.element.className =
        "pswp__content-video flex items-center justify-center w-full h-full p-4 md:p-12";
      content.element.innerHTML =
        `<video class="max-w-full max-h-full object-contain" src="${
          escapeAttr(data.src)
        }" ${videoAttrs}></video>`;
      content.state = "loaded";
    }
  });

  // 3. Custom UI Registration
  lightbox.on("uiRegister", () => {
    const pswp = lightbox.pswp;
    if (!pswp) return;

    // A. Main Controls
    pswp.ui.registerElement({
      name: "custom-controls",
      appendTo: "root",
      onInit: (el) => {
        const controls = getTemplate("pswp-template-controls");
        if (!controls) return;

        const closeBtn = controls.querySelector(".pswp-close-btn");
        const moreBtn = controls.querySelector(".pswp-more-btn");
        const moreMenu = controls.querySelector(
          ".pswp-more-menu",
        ) as HTMLElement;
        const viewPost = controls.querySelector(
          ".pswp-view-post",
        ) as HTMLAnchorElement;
        const openOrig = controls.querySelector(
          ".pswp-open-original",
        ) as HTMLAnchorElement;
        const download = controls.querySelector(".pswp-download");

        closeBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.close();
        });
        moreBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          moreMenu?.classList.toggle("opacity-0");
          moreMenu?.classList.toggle("pointer-events-none");
          moreMenu?.classList.toggle("scale-95");
        });

        download?.addEventListener("click", () => {
          const data = pswp.currSlide?.data as PswpItem;
          if (data?.src) downloadMedia(data.src);
        });

        pswp.on("change", () => {
          const data = pswp.currSlide?.data as PswpItem;
          if (!data) return;

          if (viewPost) {
            viewPost.classList.toggle("hidden", !data.postUrl);
            if (data.postUrl) viewPost.href = data.postUrl;
          }
          if (openOrig && data.src) openOrig.href = data.src;

          const dotsContainer = controls.querySelector(".pswp-dots");
          if (dotsContainer) {
            const total = pswp.getNumItems();
            dotsContainer.classList.toggle("hidden", total <= 1);
            if (total > 1) {
              dotsContainer.innerHTML = "";
              for (let i = 0; i < total; i++) {
                const dot = getTemplate(
                  "pswp-template-dot",
                ) as HTMLButtonElement;
                if (dot) {
                  if (i === pswp.currIndex) {
                    dot.setAttribute("data-active", "true");
                    dot.disabled = true;
                  }
                  dot.addEventListener("click", (e) => {
                    e.stopPropagation();
                    pswp.goTo(i);
                  });
                  dotsContainer.appendChild(dot);
                }
              }
            }
          }

          const counter = controls.querySelector(".pswp-counter");
          if (counter) {
            const total = pswp.getNumItems();
            counter.classList.toggle("hidden", total <= 1);
            if (total > 1) {
              counter.textContent = `${pswp.currIndex + 1} / ${total}`;
            }
          }
        });

        el.appendChild(controls);
      },
    });

    // B. Alt Sheet
    pswp.ui.registerElement({
      name: "custom-alt",
      appendTo: "root",
      onInit: (el) => {
        const altTrigger = getTemplate("pswp-template-alt");
        const sheetWrapper = getTemplate("pswp-template-sheet");
        if (!altTrigger || !sheetWrapper) return;

        const captionPreview = altTrigger.querySelector(
          ".pswp-caption-preview",
        );
        const backdrop = sheetWrapper.querySelector(
          ".pswp-sheet-backdrop",
        ) as HTMLElement;
        const sheet = sheetWrapper.querySelector(".pswp-sheet") as HTMLElement;
        const content = sheetWrapper.querySelector(".pswp-sheet-content");
        const closeSheet = sheetWrapper.querySelector(".pswp-sheet-close");

        const openAlt = (e: Event) => {
          e.stopPropagation();
          const data = pswp.currSlide?.data as PswpItem;
          if (!data?.alt || !content) return;
          content.textContent = data.alt;
          backdrop.classList.remove("opacity-0", "pointer-events-none");
          sheet.classList.remove("translate-y-full");
          sheet.style.transform = ""; // Reset any manual transform from swipe
        };

        const closeAlt = () => {
          backdrop.classList.add("opacity-0", "pointer-events-none");
          sheet.classList.add("translate-y-full");
          sheet.style.transform = "";
        };

        altTrigger.addEventListener("click", openAlt);
        backdrop.addEventListener("click", closeAlt);
        closeSheet?.addEventListener("click", closeAlt);

        // Swipe to close functionality
        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        sheet.addEventListener("touchstart", (e) => {
          startY = e.touches[0].clientY;
          isDragging = true;
          sheet.style.transition = "none";
          // Prevent PhotoSwipe from handling this touch
          e.stopPropagation();
        }, { passive: true });

        sheet.addEventListener("touchmove", (e) => {
          if (!isDragging) return;
          currentY = e.touches[0].clientY;
          const diff = currentY - startY;

          // Only allow swiping down
          if (diff > 0) {
            sheet.style.transform = `translateY(${diff}px)`;
            // Fade backdrop based on distance
            const opacity = Math.max(0, 1 - (diff / 300));
            backdrop.style.opacity = opacity.toString();
          }

          // Stop propagation to prevent background scroll/swipe
          e.stopPropagation();
        }, { passive: true });

        sheet.addEventListener("touchend", () => {
          if (!isDragging) return;
          isDragging = false;
          sheet.style.transition = "";
          backdrop.style.opacity = "";

          const diff = currentY - startY;
          if (diff > 100) {
            closeAlt();
          } else {
            sheet.style.transform = "";
          }
        });

        // Prevent scrolls from propagating to the background
        sheet.addEventListener("wheel", (e) => e.stopPropagation(), {
          passive: true,
        });

        pswp.on("change", () => {
          const data = pswp.currSlide?.data as PswpItem;
          const hasAlt = Boolean(data?.alt);
          altTrigger.classList.toggle("opacity-0", !hasAlt);
          altTrigger.classList.toggle("pointer-events-none", !hasAlt);
          if (captionPreview) captionPreview.textContent = data?.alt || "";
          closeAlt();
        });

        el.appendChild(altTrigger);
        el.appendChild(sheetWrapper);
      },
    });

    // C. Navigation
    pswp.ui.registerElement({
      name: "custom-nav",
      appendTo: "root",
      onInit: (el) => {
        const nav = getTemplate("pswp-template-nav");
        if (!nav) return;

        const prev = nav.querySelector(".pswp-prev");
        const next = nav.querySelector(".pswp-next");
        prev?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.prev();
        });
        next?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.next();
        });

        pswp.on("change", () => {
          const total = pswp.getNumItems();
          if (prev) {
            (prev as HTMLElement).style.visibility = pswp.currIndex === 0
              ? "hidden"
              : "visible";
          }
          if (next) {
            (next as HTMLElement).style.visibility =
              pswp.currIndex === total - 1 ? "hidden" : "visible";
          }
        });

        el.appendChild(nav);
      },
    });

    // D. Trackpad Gestures (Discrete for Native Animations)
    let wheelTimeout: any;
    pswp.on("bindEvents", () => {
      pswp.container.addEventListener("wheel", (e: WheelEvent) => {
        if (wheelTimeout) return;

        const threshX = 50;
        const threshY = 80;

        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          // Horizontal Navigation
          if (Math.abs(e.deltaX) > threshX) {
            if (e.deltaX > 0) pswp.next();
            else pswp.prev();
            wheelTimeout = setTimeout(() => {
              wheelTimeout = null;
            }, 600);
          }
        } else if (Math.abs(e.deltaY) > threshY) {
          // Vertical Close
          pswp.close();
          wheelTimeout = setTimeout(() => {
            wheelTimeout = null;
          }, 600);
        }
      }, { passive: true });
    });
  });

  lightbox.on("openingAnimationStart", () => {
    document.documentElement.classList.add("pswp-open");
  });

  lightbox.on("destroy", () => {
    document.documentElement.classList.remove("pswp-open");
  });

  lightbox.init();
}
