// src/assets/scripts/common/lightbox.ts
import PhotoSwipe from "photoswipe";
import PhotoSwipeLightbox from "photoswipe/lightbox";

let lightbox: PhotoSwipeLightbox | null = null;

/**
 * Initialize PhotoSwipe for all galleries on the page.
 * Uses a data-attribute based approach for better reliability.
 */
export function initPhotoSwipe() {
  if (lightbox) {
    lightbox.destroy();
    lightbox = null;
  }

  // Use a broad selector to catch all potential galleries/entries
  // PhotoSwipe can be initialized on a shared selector
  lightbox = new PhotoSwipeLightbox({
    gallery: "a.note-gallery__link",
    pswpModule: PhotoSwipe,
    showHideAnimationType: "zoom",
    bgOpacity: 0.95,
    padding: { top: 20, bottom: 40, left: 20, right: 20, },
    initialZoomLevel: "fit",
    secondaryZoomLevel: 1.5,
    maxZoomLevel: 3,
    closeOnVerticalDrag: true,
    pinchToClose: true,
    escKey: true,
    arrowKeys: true,
  },);

  /**
   * 1. Handle item data (Dimensions & Alt Text Extraction)
   */
  lightbox.on("itemData", (e: any,) => {
    const { itemData, } = e;
    const { element, } = itemData;

    if (!element) return;

    const thumb = element.querySelector("img",);
    if (thumb) {
      itemData.thumbEl = thumb;
      const fullSizeUrl = element.getAttribute("href",);
      itemData.src = fullSizeUrl;

      // Extract Alt Text for captions
      itemData.alt = thumb.getAttribute("alt",) || "";

      const widthAttr = element.getAttribute("data-pswp-width",);
      const heightAttr = element.getAttribute("data-pswp-height",);

      if (
        widthAttr && heightAttr && widthAttr !== "auto" && heightAttr !== "auto"
      ) {
        itemData.width = parseInt(widthAttr, 10,);
        itemData.height = parseInt(heightAttr, 10,);
      } else if (thumb.complete && thumb.naturalWidth > 0) {
        itemData.width = thumb.naturalWidth;
        itemData.height = thumb.naturalHeight;
      } else {
        // Fallback to auto-detection during load if needed
        itemData.width = 0;
        itemData.height = 0;
      }

      const srcset = thumb.getAttribute("srcset",);
      if (srcset) {
        itemData.srcset = srcset;
      }
    }
  },);

  /**
   * 2. Register the Custom Caption Element
   */
  lightbox.on("uiRegister", () => {
    if (!lightbox || !lightbox.pswp || !lightbox.pswp.ui) return;

    lightbox.pswp.ui.registerElement({
      name: "custom-caption",
      order: 9,
      isButton: false,
      appendTo: "root",
      html: "Caption text",
      onInit: (el: HTMLElement, pswp: any,) => {
        pswp.on("change", () => {
          const currSlide = pswp.currSlide;
          if (currSlide && currSlide.data && currSlide.data.alt) {
            el.innerHTML = currSlide.data.alt;
            el.classList.remove("pswp__custom-caption--empty",);
          } else {
            el.innerHTML = "";
            el.classList.add("pswp__custom-caption--empty",);
          }
        },);
      },
    },);
  },);

  lightbox.init();
}

// Global initialization
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPhotoSwipe,);
  } else {
    initPhotoSwipe();
  }
}
