import * as path from "@std/path";
import type { Page, Site, } from "lume/core.ts";
import { site as settings, } from "../_config/metadata.ts";

function extractImagesFromNote(content: string,) {
  const images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }> = [];

  const imgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
  let match;

  while ((match = imgRegex.exec(content,)) !== null) {
    images.push({
      alt: match[1] || "",
      src: match[2],
    },);
  }

  return images;
}

function normalizeUrl(url: string,) {
  if (!url) return "";
  return url.endsWith("/",) ? url.slice(0, -1,) : url;
}

export default function registerPreprocessors(site: Site,) {
  site.preprocess([".md",], (pages: Page[],) => {
    for (const page of pages) {
      const pageUrl = page.data.url as string;
      if (!pageUrl) continue;

      const isNote = page.src.path.startsWith("/notes/",)
        || page.data.type === "note";

      // Extract images ONLY for notes (Arts Journal style)
      if (isNote && typeof page.data.content === "string") {
        const rawContent = page.data.content;
        const images = extractImagesFromNote(rawContent,);

        if (images.length > 0) {
          page.data.images = images;
          const coverSrc = images[0]?.src;
          page.data.coverImage = coverSrc;
          page.data.coverImageAlt = images[0]?.alt;

          // Optimization: Use the -preview.jpg version for social media if it's a gallery image
          if (coverSrc && coverSrc.includes("/gallery/",)) {
            page.data.metaImage = coverSrc.replace(
              /(\.[a-z]+)$/,
              "-preview.jpg",
            );
          }

          page.data.content = rawContent.replace(
            /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
            "",
          ).trim();
        }
      }

      // Webmention stats logic
      const stats = { likes: 0, reposts: 0, replies: 0, };
      const webmentions = page.data.webmentions as any;

      if (webmentions?.children?.length) {
        const siteUrl = settings.url;
        const absPageUrl = normalizeUrl(siteUrl + pageUrl,);

        const relevantMentions = webmentions.children.filter(
          (entry: any,) =>
            normalizeUrl(entry["wm-target"] || "",) === absPageUrl,
        );

        stats.likes = relevantMentions.filter((m: any,) =>
          m["wm-property"] === "like-of"
        ).length;
        stats.reposts = relevantMentions.filter((m: any,) =>
          m["wm-property"] === "repost-of"
        ).length;
        stats.replies = relevantMentions.filter((m: any,) =>
          ["mention-of", "in-reply-to",].includes(m["wm-property"],)
        ).length;
      }

      page.data.stats = stats;
    }
  },);
}
