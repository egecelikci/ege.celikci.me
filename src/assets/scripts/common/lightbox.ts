// src/assets/scripts/lightbox.ts
import PhotoSwipe from "npm:photoswipe@^5.4.4";
import PhotoSwipeLightbox from "npm:photoswipe@^5.4.4/lightbox";

let lightbox: PhotoSwipeLightbox | null = null;

export function initPhotoSwipe() {
  if (lightbox) {
    lightbox.destroy();
    lightbox = null;
  }

  // UPDATED: Use .h-entry as fallback for single notes/posts
  const galleryRoot = document.querySelector("#notes-container",)
    || document.querySelector(".h-entry",);

  if (!galleryRoot) return;

  let childrenSelector = "a.note-gallery__link";

  // If we are on the notes list, we only want the first image of each note
  if (galleryRoot.id === "notes-container") {
    childrenSelector = ".js-lightbox-item";

    // UPDATED: Look for .timeline-item instead of .notelist__item
    const items = galleryRoot.querySelectorAll(".timeline-item",);

    items.forEach((item,) => {
      const links = item.querySelectorAll("a.note-gallery__link",);
      links.forEach((link, index,) => {
        // Only the first image in a note becomes part of the lightbox gallery
        if (index === 0) {
          link.classList.add("js-lightbox-item",);
        } else {
          link.classList.remove("js-lightbox-item",);
        }
      },);
    },);
  }

  lightbox = new PhotoSwipeLightbox({
    gallery: galleryRoot as HTMLElement,
    children: childrenSelector,
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

      // Extract Alt Text
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
    if (!lightbox) return;
    lightbox.pswp!.ui!.registerElement({
      name: "custom-caption",
      order: 9,
      isButton: false,
      appendTo: "root",
      html: "Caption text",
      onInit: (el: HTMLElement, pswp: any,) => {
        lightbox!.pswp!.on("change", () => {
          const currSlide = lightbox!.pswp!.currSlide;
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

  lightbox.on("loading", (e: any,) => {
    const { slide, } = e;
    if (slide.state === "loading") {
      slide.container.classList.add("pswp--loading",);
    }
    slide.on("loaded", () => {
      slide.container.classList.remove("pswp--loading",);
    },);
  },);

  lightbox.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPhotoSwipe,);
} else {
  initPhotoSwipe();
}
