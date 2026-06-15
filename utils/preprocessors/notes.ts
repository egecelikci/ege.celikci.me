/**
 * utils/preprocessors/notes.ts
 * Extracts metadata (description, coverImage) from note content.
 */

import type { Page, Site } from "lume/core.ts";

export default function () {
  return (site: Site) => {
    site.preprocess("*", (pages: Page[]) => {
      const notePages = pages.filter((p) => p.data.type === "note");

      for (const page of notePages) {
        const content = page.data.content as string;
        if (!content) continue;

        // 1. Extract first image as coverImage/metaImage
        if (!page.data.coverImage) {
          const imgMatch = content.match(/!\[(.*?)\]\(([^)\s]+)\)/);
          if (imgMatch) {
            page.data.coverImage = imgMatch[2];
            // If alt text exists, use it as a starting point for description if needed
            if (imgMatch[1] && !page.data.description) {
              page.data.description = imgMatch[1];
            }
          }
        }

        // 2. Extract description (teaser) if not already set by alt text
        if (!page.data.description || page.data.description.length < 10) {
          // Remove Markdown images and links for the teaser
          let teaser = content
            .replace(/!\[.*?\]\(.*?\)/g, "") // Remove images
            .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Simplify links
            .replace(/[#*`_>]/g, "") // Remove common MD markers (including blockquotes)
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();

          if (teaser) {
            if (teaser.length > 200) {
              teaser = teaser.substring(0, 197) + "...";
            }
            page.data.description = teaser;
          }
        }

        // Final fallbacks and mappings
        if (page.data.coverImage) {
          page.data.metaImage = page.data.coverImage;
        }
      }
    });
  };
}
