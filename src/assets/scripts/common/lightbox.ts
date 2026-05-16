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
  cropped?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

let isLightboxInitialized = false;

export function initLightbox() {
  if (isLightboxInitialized) return;
  isLightboxInitialized = true;

  const lightbox = new PhotoSwipeLightbox({
    gallery: "[data-lightbox-group], .markdown",
    children: "a.lightbox-trigger, img:not(.lightbox-trigger img)",
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
    showAnimationDuration: 200,
    hideAnimationDuration: 200,
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
      itemData.cropped = anchor.getAttribute("data-cropped") === "true";

      const w = anchor.getAttribute("data-pswp-width") ||
        img?.getAttribute("width");
      const h = anchor.getAttribute("data-pswp-height") ||
        img?.getAttribute("height");

      itemData.width = w ? parseInt(w, 10) : (img?.naturalWidth || 0);
      itemData.height = h ? parseInt(h, 10) : (img?.naturalHeight || 0);

      itemData.postUrl = anchor.getAttribute("data-post-url");
      itemData.mediaType = anchor.getAttribute("data-media-type") || "image";
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
    // Use the exact anchor container bounds, bypassing the scaled inner image
    return (itemData.element as HTMLElement) || thumbnail;
  });

  lightbox.addFilter("placeholderSrc", (placeholderSrc, content) => {
    return (content.data as PswpItem).msrc || placeholderSrc;
  });

  // 2. Video/Gifv Support
  lightbox.on("contentLoad", (e) => {
    const { content } = e;
    const data = content.data as PswpItem;
    if (data.mediaType === "video" || data.mediaType === "gifv") {
      e.preventDefault();
      content.element = document.createElement("div");
      content.element.className =
        "pswp__content-video flex items-center justify-center w-full h-full p-4 md:p-12";

      const video = document.createElement("video");
      video.className = "max-w-full max-h-full object-contain";
      video.setAttribute("aria-label", data.alt || "Video");
      video.src = data.src || "";

      if (data.mediaType === "gifv") {
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
      } else {
        video.controls = true;
      }

      content.element.appendChild(video);
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
        const counter = controls.querySelector(".pswp-counter") as HTMLElement;

        let isMenuOpen = false;

        const handleOutsideClick = (e: MouseEvent) => {
          if (
            !moreBtn?.contains(e.target as Node) &&
            !moreMenu?.contains(e.target as Node)
          ) {
            closeMoreMenu();
          }
        };

        const closeMoreMenu = () => {
          if (!isMenuOpen) return;
          isMenuOpen = false;
          moreMenu?.classList.add(
            "opacity-0",
            "pointer-events-none",
            "scale-95",
          );
          moreBtn?.setAttribute("aria-expanded", "false");
          document.removeEventListener("click", handleOutsideClick);
        };

        const openMoreMenu = () => {
          isMenuOpen = true;
          moreMenu?.classList.remove(
            "opacity-0",
            "pointer-events-none",
            "scale-95",
          );
          moreBtn?.setAttribute("aria-expanded", "true");
          // Defer to prevent this click from immediately closing
          requestAnimationFrame(() => {
            document.addEventListener("click", handleOutsideClick);
          });
        };

        closeBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.close();
        });

        moreBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          isMenuOpen ? closeMoreMenu() : openMoreMenu();
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

        const onPointerMove = showControls;
        const onTouchStart = showControls;

        pswp.element?.addEventListener("pointermove", onPointerMove);
        pswp.element?.addEventListener("touchstart", onTouchStart);

        pswp.on("destroy", () => {
          if (idleTimer) clearTimeout(idleTimer);
          pswp.element?.removeEventListener("pointermove", onPointerMove);
          pswp.element?.removeEventListener("touchstart", onTouchStart);
          document.removeEventListener("click", handleOutsideClick);
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
              dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
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
                dot.setAttribute(
                  "aria-label",
                  `Go to slide ${i + 1}${active ? " (current)" : ""}`,
                );
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
          const alt = data?.alt?.trim();
          if (!alt || !content) return;
          content.textContent = alt;
          isSheetOpen = true;
          backdrop.classList.remove("opacity-0", "pointer-events-none");
          sheet.classList.remove(
            "translate-y-full",
            "opacity-0",
            "pointer-events-none",
          );
          sheet.style.transform = "";
          closeSheet?.focus({ preventScroll: true }); // Move focus into dialog
        };

        const closeAlt = () => {
          if (!isSheetOpen) return;
          isSheetOpen = false;
          backdrop.classList.add("opacity-0", "pointer-events-none");
          sheet.classList.add(
            "translate-y-full",
            "opacity-0",
            "pointer-events-none",
          );
          sheet.style.transform = "";
          (altTrigger.querySelector("button") as HTMLButtonElement)?.focus({
            preventScroll: true,
          }); // Restore focus
        };

        const handleKeydown = (e: KeyboardEvent) => {
          if (e.key === "Escape" && isSheetOpen) {
            e.stopPropagation();
            closeAlt();
          }
        };

        altTrigger.addEventListener("click", openAlt);
        backdrop.addEventListener("click", closeAlt);
        closeSheet?.addEventListener("click", closeAlt);
        document.addEventListener("keydown", handleKeydown);

        pswp.on("destroy", () => {
          document.removeEventListener("keydown", handleKeydown);
        });

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
          const alt = data?.alt?.trim() || "";
          const hasAlt = alt.length > 0;

          altTrigger.classList.toggle("opacity-0", !hasAlt);
          altTrigger.classList.toggle("pointer-events-none", !hasAlt);

          // Hide the entire sheet wrapper if no alt text
          sheetWrapper.classList.toggle("hidden", !hasAlt);

          if (captionPreview) captionPreview.textContent = alt;
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

        const updateNav = () => {
          const total = pswp.getNumItems();
          if (prev) {
            prev.hidden = total <= 1;
            prev.disabled = pswp.currIndex === 0;
            prev.setAttribute("aria-disabled", String(pswp.currIndex === 0));
          }
          if (next) {
            next.hidden = total <= 1;
            next.disabled = pswp.currIndex === total - 1;
            next.setAttribute(
              "aria-disabled",
              String(pswp.currIndex === total - 1),
            );
          }
        };

        updateNav();

        prev?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.prev();
        });
        next?.addEventListener("click", (e) => {
          e.stopPropagation();
          pswp.next();
        });

        pswp.on("change", updateNav);

        el.appendChild(nav);
      },
    });
  });

  lightbox.on("beforeOpen", () => {
    // Set scrollbar width variable for CSS compensation
    document.documentElement.style.setProperty(
      "--pswp-sw",
      `${window.innerWidth - document.documentElement.clientWidth}px`,
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
