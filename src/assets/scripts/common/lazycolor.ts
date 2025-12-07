// src/assets/scripts/common/lazycolor.ts

const albumItems = document.querySelectorAll(".album__item",);

if (albumItems.length) {
  albumItems.forEach((item,) => {
    const colorImage = item.querySelector(
      ".js-lazy-color",
    ) as HTMLImageElement;

    if (colorImage && colorImage.dataset.hoverSrc) {
      const loadImage = () => {
        colorImage.src = colorImage.dataset.hoverSrc!;
      };

      // Load on hover/focus
      item.addEventListener("mouseenter", loadImage, { once: true, },);
      item.addEventListener("focusin", loadImage, { once: true, },);
    }
  },);
}
