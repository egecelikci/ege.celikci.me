import htmlMinifier from "html-minifier";
import { JSDOM, } from "jsdom";
import { EventEmitter, } from "node:events";

// Increase max listeners to prevent warnings
EventEmitter.defaultMaxListeners = Infinity;

/**
 * Transform images in notes to PhotoSwipe-compatible gallery links.
 * Must run AFTER eleventyImageTransform so we can access processed images.
 */
function galleryTransform(
  content: string,
  outputPath: string,
): string {
  if (
    !outputPath
    || !outputPath.endsWith(".html",)
    || !outputPath.includes("/notes/",)
  ) {
    return content;
  }

  const dom = new JSDOM(content,);
  const document = dom.window.document;

  const noteContents = document.querySelectorAll(".note__content .markdown",);

  for (const noteContent of noteContents) {
    // Find PICTURE elements that aren't already wrapped in links
    const pictures = noteContent.querySelectorAll("picture:not(a picture)",);

    for (const picture of pictures) {
      // Get the main <img> inside the picture
      const img = picture.querySelector("img",);
      if (!img) continue;

      const imgSrc = img.getAttribute("src",);
      if (!imgSrc) continue;

      // Trust the attributes provided by eleventy-img
      const width = img.getAttribute("width",);
      const height = img.getAttribute("height",);

      const fullSizeUrl = imgSrc;

      // Create wrapper link
      const link = document.createElement("a",);
      link.href = fullSizeUrl;
      link.className = "note-gallery__link";
      link.setAttribute("data-pswp-width", width || "auto",);
      link.setAttribute("data-pswp-height", height || "auto",);
      link.setAttribute("target", "_blank",);
      link.setAttribute("rel", "noopener",);

      // Store thumbnail src for reference
      link.setAttribute("data-thumb-src", imgSrc,);

      // Wrap the entire picture element
      if (picture.parentNode) {
        picture.parentNode.insertBefore(link, picture,);
        link.appendChild(picture,);
      }
    }
  }

  return dom.serialize();
}

/**
 * Minify HTML in production
 */
function htmlMinTransform(rawContent: string, outputPath: string,): string {
  if (
    Deno.env.get("NODE_ENV",) === "production"
    && outputPath
    && outputPath.endsWith(".html",)
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
    },);
  }
  return rawContent;
}

export default {
  galleryTransform,
  htmlMinTransform,
};
