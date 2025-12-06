import htmlMinifier from "html-minifier";
import { JSDOM } from "jsdom";

process.setMaxListeners(Infinity);

/**
 * Transform images in notes to PhotoSwipe-compatible gallery links.
 * Must run AFTER eleventyImageTransform so we can access processed images.
 */
async function galleryTransform(content, outputPath) {
  if (
    !outputPath ||
    !outputPath.endsWith(".html") ||
    !outputPath.includes("/notes/")
  ) {
    return content;
  }

  const dom = new JSDOM(content);
  const document = dom.window.document;

  const noteContents = document.querySelectorAll(".note__content .markdown");

  for (const noteContent of noteContents) {
    // Find PICTURE elements that aren't already wrapped in links
    const pictures = noteContent.querySelectorAll("picture:not(a picture)");

    for (const picture of pictures) {
      // Get the main <img> inside the picture
      const img = picture.querySelector("img");
      if (!img) continue;

      const imgSrc = img.getAttribute("src");
      if (!imgSrc) continue;

      // Trust the attributes provided by eleventy-img
      const width = img.getAttribute("width");
      const height = img.getAttribute("height");

      // We need a full-size URL for the lightbox.
      // Since we don't want to parse complex srcsets, we can assume the 'src'
      // attribute (which points to the fallback/default format) is sufficient
      // for the lightbox target, OR we can try to grab the largest source if needed.
      // For simplicity and speed, using the 'src' is usually safe if it's high-res enough.
      // However, eleventy-img usually puts the smallest or middle size in 'src' depending on config.
      // A safer bet without parsing files is to check if there's a source with a larger width descriptor,
      // but strictly adhering to your request to remove FS reads, we will trust the provided src.
      // Ideally, the image transform should be configured to put the largest image in 'src' or we accept what we have.

      // Better approach for 'fullSizeUrl':
      // Check if there is a <source> with a 'data-original' or similar if we configured it,
      // otherwise, just use the img src.
      let fullSizeUrl = imgSrc;

      // Create wrapper link
      const link = document.createElement("a");
      link.href = fullSizeUrl;
      link.className = "note-gallery__link";
      link.setAttribute("data-pswp-width", width || "auto");
      link.setAttribute("data-pswp-height", height || "auto");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");

      // Store thumbnail src for reference
      link.setAttribute("data-thumb-src", imgSrc);

      // Wrap the entire picture element
      picture.parentNode.insertBefore(link, picture);
      link.appendChild(picture);
    }
  }

  return dom.serialize();
}

/**
 * Minify HTML in production
 */
function htmlMinTransform(rawContent, outputPath) {
  if (
    process.env.NODE_ENV === "production" &&
    outputPath &&
    outputPath.endsWith(".html")
  ) {
    return htmlMinifier.minify(rawContent, {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      removeComments: true,
      sortClassName: true,
      sortAttributes: true,
      html5: true,
      decodeEntities: true,
      removeOptionalTags: true,
    });
  }
  return rawContent;
}

export default {
  galleryTransform,
  htmlMinTransform,
};
