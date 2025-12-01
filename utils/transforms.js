import htmlMinifier from "html-minifier";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import path from "path";
import fs from "fs";

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

      // Parse srcset to find the largest image for PhotoSwipe
      const srcset = img.getAttribute("srcset");
      let fullSizeUrl = imgSrc;
      let fullWidth = 0;
      let fullHeight = 0;

      if (srcset) {
        // ROBUSTNESS: Use regex to split srcset to handle potential commas in URLs safely
        // Matches comma followed by whitespace, assuming typical srcset format
        const sources = srcset.split(/,\s+/);

        const parsed = sources.map((source) => {
          const parts = source.trim().split(/\s+/);
          const url = parts[0];
          // The last part is usually the descriptor (e.g. "1200w")
          const descriptor = parts[parts.length - 1];
          const width = descriptor.endsWith("w")
            ? parseInt(descriptor.slice(0, -1))
            : 0;
          return { url, width };
        });

        // Sort by width descending to get the largest
        parsed.sort((a, b) => b.width - a.width);
        if (parsed.length > 0) {
          fullSizeUrl = parsed[0].url;
        }
      }

      // Get dimensions from the img attributes (set by Eleventy Image Transform)
      const widthAttr = img.getAttribute("width");
      const heightAttr = img.getAttribute("height");

      if (widthAttr && heightAttr) {
        fullWidth = parseInt(widthAttr);
        fullHeight = parseInt(heightAttr);
      } else {
        // Fallback: try to get dimensions from the file
        // Only works if the file exists locally in dist (depends on build order)
        if (fullSizeUrl.startsWith("/")) {
          try {
            const imagePath = path.join("./dist", fullSizeUrl);
            if (fs.existsSync(imagePath)) {
              const metadata = await sharp(imagePath).metadata();
              fullWidth = metadata.width;
              fullHeight = metadata.height;
            }
          } catch (err) {
            // Log but don't crash the build
            console.warn(
              `[GalleryTransform] Could not get dimensions for ${fullSizeUrl}: ${err.message}`,
            );
          }
        }
      }

      // Create wrapper link
      const link = document.createElement("a");
      link.href = fullSizeUrl;
      link.className = "note-gallery__link";
      link.setAttribute(
        "data-pswp-width",
        fullWidth > 0 ? fullWidth.toString() : "auto",
      );
      link.setAttribute(
        "data-pswp-height",
        fullHeight > 0 ? fullHeight.toString() : "auto",
      );
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
