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

  let childrenSelector = "a.note-gallery__link";

  // If we are on the notes list, we only want the first image of each note
  if (galleryRoot.id === "notes-container") {
    childrenSelector = ".js-lightbox-item";
    const items = galleryRoot.querySelectorAll(".notelist__item");
    items.forEach((item) => {
      const links = item.querySelectorAll("a.note-gallery__link");
      links.forEach((link, index) => {
        if (index === 0) {
          link.classList.add("js-lightbox-item");
        } else {
          link.classList.remove("js-lightbox-item");
        }
      });
    });
  }

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryRoot,
    children: childrenSelector,
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
   * 1. Handle item data (Dimensions & Alt Text Extraction)
   */
  lightbox.on("itemData", (e) => {
    const { itemData } = e;
    const { element } = itemData;

    if (!element) return;

    const thumb = element.querySelector("img");
    if (thumb) {
      itemData.thumbEl = thumb;
      const fullSizeUrl = element.getAttribute("href");
      itemData.src = fullSizeUrl;

      // --- NEW: Extract Alt Text ---
      // We store it in itemData so the UI element can access it later
      itemData.alt = thumb.getAttribute("alt") || "";

      const width = element.getAttribute("data-pswp-width");
      const height = element.getAttribute("data-pswp-height");

      if (width !== "auto" && height !== "auto") {
        itemData.width = parseInt(width);
        itemData.height = parseInt(height);
      } else {
        if (thumb.complete && thumb.naturalWidth > 0) {
          itemData.width = thumb.naturalWidth;
          itemData.height = thumb.naturalHeight;
        }
      }

      const srcset = thumb.getAttribute("srcset");
      if (srcset) {
        itemData.srcset = srcset;
      }
    } else {
      lightbox.options.showHideAnimationType = "fade";
    }
  });

  /**
   * 2. Register the Custom Caption Element
   * This creates a place in the UI to display the text we extracted above.
   */
  lightbox.on("uiRegister", () => {
    lightbox.pswp.ui.registerElement({
      name: "custom-caption",
      order: 9, // Ensure it sits above other background elements
      isButton: false,
      appendTo: "root", // 'root' puts it in the main container, overlaying the image
      html: "Caption text",
      onInit: (el, pswp) => {
        lightbox.pswp.on("change", () => {
          const currSlide = lightbox.pswp.currSlide;
          if (currSlide && currSlide.data && currSlide.data.alt) {
            el.innerHTML = currSlide.data.alt;
            el.classList.remove("pswp__custom-caption--empty");
          } else {
            el.innerHTML = "";
            el.classList.add("pswp__custom-caption--empty");
          }
        });
      },
    });
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

  lightbox.on("contentError", (e) => {
    console.error("PhotoSwipe content error:", e);
  });

  lightbox.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPhotoSwipe);
} else {
  initPhotoSwipe();
}
