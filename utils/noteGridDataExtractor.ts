import { JSDOM, } from "jsdom";

export interface NoteGridData {
  hasImage: boolean;
  src?: string | null;
  srcset?: string | null;
  alt?: string | null;
  caption?: string;
  title?: string;
  hasMultipleImages?: boolean;
}

/**
 * Extracts grid data for a note, including image information and a clean caption.
 * @param content - The HTML content of the note.
 * @param title - The title of the note.
 * @returns An object containing extracted grid data.
 */
export function extractNoteGridData(
  content: string,
  title: string,
): NoteGridData {
  if (!content) return { hasImage: false, };

  const dom = new JSDOM(content,);
  const doc = dom.window.document;
  const images = Array.from(doc.querySelectorAll("img",),);

  if (!images.length) return { hasImage: false, };

  // Clone to manipulate for caption extraction
  const clone = doc.body.cloneNode(true,) as HTMLElement;

  // Remove elements we don't want in caption
  const toRemove = Array.from(clone.querySelectorAll(
    "img, video, svg, script, style, .note__link, .note-gallery__link",
  ),);
  toRemove.forEach((el,) => el.remove());

  const caption = clone.textContent?.replace(/\s+/g, " ",).trim() || "";
  const img = images[0] as HTMLImageElement;

  return {
    hasImage: true,
    src: img.getAttribute("src",),
    srcset: img.getAttribute("srcset",),
    alt: img.getAttribute("alt",) || title || caption,
    caption: caption,
    title: title,
    hasMultipleImages: images.length > 1,
  };
}
