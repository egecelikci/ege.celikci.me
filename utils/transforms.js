import htmlMinifier from "html-minifier";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import path from "path";
import fs from "fs";

// This is still needed for the JSDOM/image-size logic
// and is a good practice for asynchronous operations in Node.
process.setMaxListeners(Infinity);

/**
 * Transform images in notes to PhotoSwipe-compatible gallery links.
 * Only processes pages with 'notes' in the URL and that are HTML files.
 */
async function galleryTransform(content, outputPath) {
  // Only process HTML files in /notes/ paths
  if (
    !outputPath ||
    !outputPath.endsWith(".html") ||
    !outputPath.includes("/notes/")
  ) {
    return content;
  }

  const dom = new JSDOM(content);
  const document = dom.window.document;

  // Find all note content areas
  // Assuming '.note__content .markdown' is the correct selector for your content
  const noteContents = document.querySelectorAll(".note__content .markdown");

  for (const noteContent of noteContents) {
    // Find all images that aren't already wrapped in links
    const images = noteContent.querySelectorAll("img:not(a img)");

    for (const img of images) {
      const src = img.getAttribute("src");
      if (!src) continue;

      // Create wrapper link
      const link = document.createElement("a");
      link.href = src;
      link.className = "note-gallery__link";
      link.setAttribute("data-pswp-width", "auto");
      link.setAttribute("data-pswp-height", "auto");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");

      // Try to get actual image dimensions if it's a local file
      // NOTE: The path resolution here is based on your second snippet's logic: path.join('./dist', src)
      if (src.startsWith("/") || src.startsWith("./")) {
        try {
          // Adjust './dist' if your build output directory is different
          const imagePath = path.join("./dist", src);
          if (fs.existsSync(imagePath)) {
            const metadata = await sharp(imagePath).metadata();
            link.setAttribute("data-pswp-width", metadata.width.toString());
            link.setAttribute("data-pswp-height", metadata.height.toString());
          }
        } catch (err) {
          // If we can't get dimensions, PhotoSwipe will figure it out
          console.log(`Could not get dimensions for ${src}: ${err.message}`);
        }
      }

      // Wrap the image: insert link before image, then move image into link
      img.parentNode.insertBefore(link, img);
      link.appendChild(img);
    }
  }

  return dom.serialize();
}

/**
 * Minify HTML in production. Uses the options from your original snippet.
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
