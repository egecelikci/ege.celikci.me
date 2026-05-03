/**
 * utils/preprocessors/images.ts
 * Extracts images from Markdown content and manages cover/meta images.
 */

import type { Page, Site } from "lume/core.ts";

export function extractImagesFromNote(content: string) {
  const images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }> = [];

  // Support standard ![alt](src) and ![alt](src =WxH)
  const imgRegex =
    /!\[([^\]]*)\]\(([^)\s=]+)(?:\s+=(\d+)?x(\d+)?)?(?:\s+"([^"]+)")?\)/g;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const src = match[2];
    const width = match[3] ? parseInt(match[3], 10) : undefined;
    const height = match[4] ? parseInt(match[4], 10) : undefined;

    if (
      src.startsWith("/") || src.startsWith("http") ||
      /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(src)
    ) {
      images.push({
        alt: match[1] || "",
        src: src,
        width,
        height,
      });
    }
  }

  return images;
}

export default function () {
  return (site: Site) => {
    site.preprocess([".md"], (pages: Page[]) => {
      for (const page of pages) {
        const pageUrl = page.data.url as string;
        if (!pageUrl) continue;

        const isNote = page.src.path.startsWith("/notes/") ||
          page.data.type === "note";
        const isPost = page.src.path.startsWith("/blog/") ||
          page.data.type === "post";

        // Extract images for notes and posts
        if ((isNote || isPost) && typeof page.data.content === "string") {
          const rawContent = page.data.content;
          const images = extractImagesFromNote(rawContent);

          if (images.length > 0) {
            page.data.images = images;
            const coverSrc = images[0]?.src;

            // Only set coverImage if not already explicitly set
            if (!page.data.coverImage) {
              page.data.coverImage = coverSrc;
              page.data.coverImageAlt = images[0]?.alt;
            }

            // Optimization: Use the -preview.jpg version for social media if it's a gallery image
            // and metaImage is not explicitly set
            if (
              coverSrc && coverSrc.includes("/gallery/") && !page.data.metaImage
            ) {
              page.data.metaImage = coverSrc.replace(
                /(\.[a-z]+)$/,
                "-preview.jpg",
              );
            }

            // For notes, we traditionally strip images from the content for the feed/listing
            if (isNote) {
              page.data.content = rawContent.replace(
                /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
                "",
              ).trim();
            }
          }
        }
      }
    });
  };
}
