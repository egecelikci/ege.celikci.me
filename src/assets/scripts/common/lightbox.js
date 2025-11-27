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

  lightbox.on("itemData", (e) => {
    const { itemData, index } = e;
    const { element } = itemData;

    if (element) {
      const thumb = element.querySelector("img");
      if (thumb) {
        itemData.thumbEl = thumb;

        // If dimensions are not set, try to get them from the thumbnail
        if (!itemData.width || !itemData.height) {
          if (thumb.naturalWidth) {
            itemData.width = thumb.naturalWidth;
            itemData.height = thumb.naturalHeight;
          } else {
            const img = new Image();
            img.onload = function () {
              itemData.width = this.naturalWidth;
              itemData.height = this.naturalHeight;
              lightbox.pswp?.refreshSlideContent(index);
            };
            img.src = itemData.src;
          }
        }
      } else {
        // Fallback if no thumbnail found
        lightbox.options.showHideAnimationType = "fade";
      }
    }
  });

  lightbox.on("loading", (e) => {
    const { slide } = e;
    if (slide.state === "loading") {
      slide.container.classList.add("pswp--loading");
    }
    slide.on("loaded", () => {
      slide.container.classList.remove("pswp--loading");
    });
  });

  lightbox.init();
}

initPhotoSwipe();
