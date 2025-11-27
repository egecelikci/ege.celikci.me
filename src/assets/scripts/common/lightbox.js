import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";

let lightbox = null;

export function initPhotoSwipe() {
  if (lightbox) {
    lightbox.destroy();
    lightbox = null;
  }

  const galleryRoot =
    document.querySelector("#notes-container") ||
    document.querySelector(".note");
  if (!galleryRoot) return;

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryRoot,
    children: "a.note-gallery__link",

    pswpModule: PhotoSwipe,
    showHideAnimationType: "zoom",
    bgOpacity: 0.95,
    padding: { top: 20, bottom: 40, left: 20, right: 20 },
    initialZoomLevel: "fit",
    secondaryZoomLevel: 1.5,
    maxZoomLevel: 3,
    closeOnVerticalDrag: true,
    pinchToClose: true,
    escKey: true,
    arrowKeys: true,
  });

  /**
   * Handle item data to ensure proper source URLs and dimensions
   */
  lightbox.on("itemData", (e) => {
    const { itemData } = e;
    const { element } = itemData;

    if (!element) return;

    // Get the thumbnail image
    const thumb = element.querySelector("img");
    if (thumb) {
      itemData.thumbEl = thumb;

      // The link's href should point to the full-size image
      // (set by our transform to the largest image in srcset)
      const fullSizeUrl = element.getAttribute("href");
      itemData.src = fullSizeUrl;

      // Get dimensions from data attributes (set by transform)
      const width = element.getAttribute("data-pswp-width");
      const height = element.getAttribute("data-pswp-height");

      if (width !== "auto" && height !== "auto") {
        itemData.width = parseInt(width);
        itemData.height = parseInt(height);
      } else {
        // Fallback: try to get from thumbnail's naturalWidth
        if (thumb.complete && thumb.naturalWidth > 0) {
          // This will be the thumbnail size, not the full size
          // But PhotoSwipe will adjust once the full image loads
          itemData.width = thumb.naturalWidth;
          itemData.height = thumb.naturalHeight;
        }
      }

      // Optional: Use srcset for responsive loading even in PhotoSwipe
      // PhotoSwipe will choose the best size based on viewport
      const srcset = thumb.getAttribute("srcset");
      if (srcset) {
        itemData.srcset = srcset;
      }
    } else {
      // Fallback if no thumbnail found
      lightbox.options.showHideAnimationType = "fade";
    }
  });

  /**
   * Optional: Add loading states
   */
  lightbox.on("loading", (e) => {
    const { slide } = e;
    if (slide.state === "loading") {
      slide.container.classList.add("pswp--loading");
    }
    slide.on("loaded", () => {
      slide.container.classList.remove("pswp--loading");
    });
  });

  /**
   * Optional: Handle content errors
   */
  lightbox.on("contentError", (e) => {
    console.error("PhotoSwipe content error:", e);
  });

  lightbox.init();
}

// Initialize on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPhotoSwipe);
} else {
  initPhotoSwipe();
}
