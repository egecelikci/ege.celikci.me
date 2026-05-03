/**
 * lightbox.ts
 * PhotoSwipe 5 implementation with custom Phanpy-inspired UI.
 * Refined for PhotoSwipe 5 registerElement API and fixed null-checks.
 */

import PhotoSwipe from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PswpItem {
  src?: string;
  msrc?: string;
  srcset?: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
  postUrl?: string | null;
  mediaType?: string;
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
      download: src.split("/").pop()?.split("?")[0] || "download",
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

// Calculate scrollbar width once to prevent layout shift
const getScrollbarWidth = () => {
  return window.innerWidth - document.documentElement.clientWidth;
};

export function initLightbox() {
  if (isInitialized) return;
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

    // Performance
    preload: [1, 2],

    // Gestures
    closeOnVerticalDrag: true,
    mouseMovePan: true,

    // Animation & Transitions (Sturdy & Robust)
    showHideAnimationType: "zoom",
    showAnimationDuration: 300,
    hideAnimationDuration: 250,
    easing: "cubic-bezier(0.1, 0, 0, 1)", // Phanpy-style dramatic initial pop

    // Spacing to keep image between custom UI elements
    padding: { top: 60, bottom: 60, left: 10, right: 10 },
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
      itemData.srcset = img?.getAttribute("srcset") || undefined;
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
      itemData.srcset = img.getAttribute("srcset") || undefined;
      itemData.alt = img.alt || "";
      itemData.width = parseInt(img.getAttribute("width") || "0", 10) ||
        img.naturalWidth || 0;
      itemData.height = parseInt(img.getAttribute("height") || "0", 10) ||
        img.naturalHeight || 0;
    }

    return itemData;
  });

  // 1b. Correct Thumbnail Bounds for object-fit: cover
  lightbox.addFilter("thumbEl", (thumbnail, itemData) => {
    return (itemData.element?.querySelector("img") as HTMLElement) || thumbnail;
  });

  lightbox.addFilter("thumbBounds", (thumbBounds, itemData) => {
    const el = itemData.element?.querySelector("img");
    if (!el) return thumbBounds;

    const rect = el.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      w: rect.width,
    };
  });

  lightbox.addFilter("placeholderSrc", (placeholderSrc, content) => {
    return (content.data as any).msrc || placeholderSrc;
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
        `<video class="max-w-full max-h-full object-contain" aria-label="${
          escapeAttr(data.alt || "Video")
        }" src="${escapeAttr(data.src)}" ${videoAttrs}></video>`;
      content.state = "loaded";
    }
  });

  // 3. Custom UI Registration
  lightbox.on("uiRegister", () => {
    const pswp = lightbox.pswp;
    if (!pswp) return;

    // A. Main Controls
    pswp.ui?.registerElement({
      name: "custom-controls",
      appendTo: "root",
      onInit: (el) => {
        const controls = getTemplate("pswp-template-controls");
        if (!controls) return;

        const closeBtn = controls.querySelector(".pswp-close-btn");
        const moreBtn = controls.querySelector(
          ".pswp-more-btn",
        ) as HTMLButtonElement;
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

        // Click-outside-to-close for more menu
        const closeMoreMenu = () => {
          moreMenu?.classList.add(
            "opacity-0",
            "pointer-events-none",
            "scale-95",
          );
          moreBtn?.setAttribute("aria-expanded", "false");
        };

        const handleOutsideClick = (e: MouseEvent) => {
          if (
            !moreBtn?.contains(e.target as Node) &&
            !moreMenu?.contains(e.target as Node)
          ) {
            closeMoreMenu();
          }
        };

        closeBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.close();
        });

        moreBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpening = moreMenu?.classList.toggle("opacity-0") === false;
          moreMenu?.classList.toggle("pointer-events-none", !isOpening);
          moreMenu?.classList.toggle("scale-95", !isOpening);
          moreBtn.setAttribute("aria-expanded", String(isOpening));

          if (isOpening) {
            document.addEventListener("click", handleOutsideClick, {
              once: true,
            });
          } else {
            document.removeEventListener("click", handleOutsideClick);
          }
        });

        download?.addEventListener("click", () => {
          const data = pswp.currSlide?.data as PswpItem;
          if (data?.src) downloadMedia(data.src);
        });

        // Controls auto-hide on idle (Phanpy-style)
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        const showControls = () => {
          controls.style.opacity = "1";
          controls.style.pointerEvents = "auto";
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(hideControls, 3000);
        };
        const hideControls = () => {
          if (moreMenu && !moreMenu.classList.contains("opacity-0")) return;
          controls.style.opacity = "0";
          controls.style.pointerEvents = "none";
        };
        pswp.element?.addEventListener("pointermove", showControls);
        pswp.element?.addEventListener("touchstart", showControls);

        pswp.on("destroy", () => {
          if (idleTimer) clearTimeout(idleTimer);
        });

        // Build dots once
        const dots: HTMLButtonElement[] = [];
        const dotsContainer = controls.querySelector(
          ".pswp-dots",
        ) as HTMLElement;
        if (dotsContainer) {
          const total = pswp.getNumItems();
          for (let i = 0; i < total; i++) {
            const dot = getTemplate("pswp-template-dot") as HTMLButtonElement;
            if (dot) {
              dot.addEventListener("click", (e) => {
                e.stopPropagation();
                pswp.goTo(i);
              });
              dotsContainer.appendChild(dot);
              dots.push(dot);
            }
          }
        }

        pswp.on("change", () => {
          const data = pswp.currSlide?.data as PswpItem;
          if (!data) return;

          // Close menu on slide change
          closeMoreMenu();
          document.removeEventListener("click", handleOutsideClick);

          // Pause any rogue videos from adjacent slides
          pswp.element?.querySelectorAll("video").forEach((v) => v.pause());

          // Show controls briefly on change
          showControls();

          if (viewPost) {
            viewPost.classList.toggle("hidden", !data.postUrl);
            if (data.postUrl) viewPost.href = data.postUrl;
          }
          if (openOrig && data.src) openOrig.href = data.src;

          const total = pswp.getNumItems();
          const DOTS_THRESHOLD = 5;
          const useCounter = total > DOTS_THRESHOLD;

          if (dotsContainer) {
            dotsContainer.classList.toggle("hidden", useCounter || total <= 1);
            if (!useCounter && total > 1) {
              dots.forEach((dot, i) => {
                const active = i === pswp.currIndex;
                dot.setAttribute("data-active", String(active));
                dot.disabled = active;
                if (active) {
                  dot.scrollIntoView({
                    block: "nearest",
                    inline: "center",
                    behavior: "smooth",
                  });
                }
              });
            }
          }

          const counter = controls.querySelector(".pswp-counter");
          if (counter) {
            counter.classList.toggle("hidden", !useCounter || total <= 1);
            if (useCounter && total > 1) {
              counter.textContent = `${pswp.currIndex + 1} / ${total}`;
            }
          }
        });

        el.appendChild(controls);
      },
    });

    // B. Alt Sheet
    pswp.ui?.registerElement({
      name: "custom-alt",
      appendTo: "root",
      onInit: (el) => {
        const altTrigger = getTemplate("pswp-template-alt") as HTMLElement;
        const sheetWrapper = getTemplate("pswp-template-sheet") as HTMLElement;
        if (!altTrigger || !sheetWrapper) return;

        const captionPreview = altTrigger.querySelector(
          ".pswp-caption-preview",
        );
        const backdrop = sheetWrapper.querySelector(
          ".pswp-sheet-backdrop",
        ) as HTMLElement;
        const sheet = sheetWrapper.querySelector(".pswp-sheet") as HTMLElement;
        const content = sheetWrapper.querySelector(".pswp-sheet-content");
        const closeSheet = sheetWrapper.querySelector(
          ".pswp-sheet-close",
        ) as HTMLButtonElement;

        let isSheetOpen = false;

        const openAlt = (e: Event) => {
          e.stopPropagation();
          const data = pswp.currSlide?.data as PswpItem;
          if (!data?.alt || !content) return;
          content.textContent = data.alt;
          isSheetOpen = true;
          backdrop.classList.remove("opacity-0", "pointer-events-none");
          sheet.classList.remove("translate-y-full");
          sheet.style.transform = "";
          closeSheet?.focus({ preventScroll: true }); // Move focus into dialog
        };

        const closeAlt = () => {
          if (!isSheetOpen) return;
          isSheetOpen = false;
          backdrop.classList.add("opacity-0", "pointer-events-none");
          sheet.classList.add("translate-y-full");
          sheet.style.transform = "";
          (altTrigger.querySelector("button") as HTMLButtonElement)?.focus({
            preventScroll: true,
          }); // Restore focus
        };

        altTrigger.addEventListener("click", openAlt);
        backdrop.addEventListener("click", closeAlt);
        closeSheet?.addEventListener("click", closeAlt);

        // Swipe to close functionality
        let startY = 0;
        let isDragging = false;

        sheet.addEventListener("touchstart", (e) => {
          startY = e.touches[0].clientY;
          isDragging = true;
          sheet.style.transition = "none";
          e.stopPropagation();
        }, { passive: true });

        sheet.addEventListener("touchmove", (e) => {
          if (!isDragging) return;
          const diff = e.touches[0].clientY - startY;

          // Only allow dismiss swipe when at top of scroll
          if (diff > 0 && sheet.scrollTop === 0) {
            sheet.style.transform = `translateY(${diff}px)`;
            const opacity = Math.max(0, 1 - (diff / 300));
            backdrop.style.opacity = opacity.toString();
          } else if (sheet.scrollTop > 0) {
            // Reset drag origin if they scrolled
            startY = e.touches[0].clientY;
          }

          e.stopPropagation();
        }, { passive: true });

        sheet.addEventListener("touchend", (e) => {
          if (!isDragging) return;
          isDragging = false;
          sheet.style.transition = "";
          backdrop.style.opacity = "";

          const diff = e.changedTouches[0].clientY - startY;
          if (diff > 100 && sheet.scrollTop === 0) {
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
    pswp.ui?.registerElement({
      name: "custom-nav",
      appendTo: "root",
      onInit: (el) => {
        const nav = getTemplate("pswp-template-nav");
        if (!nav) return;

        const prev = nav.querySelector(".pswp-prev") as HTMLButtonElement;
        const next = nav.querySelector(".pswp-next") as HTMLButtonElement;

        // Set correct initial visibility immediately
        const total = pswp.getNumItems();
        if (prev) prev.hidden = pswp.currIndex === 0;
        if (next) next.hidden = pswp.currIndex === total - 1;

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
          if (prev) prev.hidden = pswp.currIndex === 0;
          if (next) next.hidden = pswp.currIndex === total - 1;
        });

        el.appendChild(nav);
      },
    });
  });

  lightbox.on("beforeOpen", () => {
    // Set scrollbar width variable for CSS compensation
    document.documentElement.style.setProperty(
      "--pswp-sw",
      `${getScrollbarWidth()}px`,
    );
    document.documentElement.classList.add("pswp-open");
  });

  lightbox.on("closingAnimationStart", () => {
    document.documentElement.classList.add("pswp-closing");
  });

  lightbox.on("destroy", () => {
    document.documentElement.classList.remove("pswp-open", "pswp-closing");
  });

  lightbox.init();
}
