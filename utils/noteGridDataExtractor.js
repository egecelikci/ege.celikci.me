import { JSDOM } from "jsdom";

/**
 * Extracts grid data for a note, including image information and a clean caption.
 * @param {string} content - The HTML content of the note.
 * @param {string} title - The title of the note.
 * @returns {object} An object containing extracted grid data.
 */
export function extractNoteGridData(content, title) {
  if (!content) return { hasImage: false };

  const dom = new JSDOM(content);
  const doc = dom.window.document;
  const images = [...doc.querySelectorAll("img")];

  if (!images.length) return { hasImage: false };

  // Clone to manipulate for caption extraction
  const clone = doc.body.cloneNode(true);

  // Remove elements we don't want in caption
  const toRemove = clone.querySelectorAll(
    "img, video, svg, script, style, .note__link, .note-gallery__link",
  );
  toRemove.forEach((el) => el.remove());

  const caption = clone.textContent.replace(/\s+/g, " ").trim();
  const img = images[0];

  return {
    hasImage: true,
    src: img.getAttribute("src"),
    srcset: img.getAttribute("srcset"),
    alt: img.getAttribute("alt") || title || caption,
    caption: caption,
    title: title,
    hasMultipleImages: images.length > 1,
  };
}
