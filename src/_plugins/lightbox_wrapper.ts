export default function() {
  return (site: Lume.Site,) => {
    // Run this AFTER the image transformer so width/height attributes exist
    site.process([".html",], (pages,) => {
      for (const page of pages) {
        const document = page.document!;

        // Target images specifically inside your markdown content container
        const images = document.querySelectorAll(".markdown img",);

        if (images.length === 0) continue;

        // Ensure the parent container has the gallery attribute for PhotoSwipe
        const container = document.querySelector(".markdown",);
        if (container && !container.hasAttribute("data-pswp-gallery",)) {
          container.setAttribute("data-pswp-gallery", "",);
        }

        images.forEach((img,) => {
          // Skip if already linked (e.g. you manually wrapped it in markdown)
          if (img.closest("a",)) return;

          const src = img.getAttribute("src",);
          const width = img.getAttribute("width",);
          const height = img.getAttribute("height",);

          // We need dimensions for PhotoSwipe to work smoothly
          if (src && width && height) {
            const link = document.createElement("a",);
            link.setAttribute("href", src,);
            link.setAttribute("target", "_blank",);
            link.setAttribute("data-pswp-width", width,);
            link.setAttribute("data-pswp-height", height,);
            link.setAttribute("class", "note-gallery__link",);

            // Wrap the image
            img.replaceWith(link,);
            link.appendChild(img,);
          }
        },);
      }
    },);
  };
}
