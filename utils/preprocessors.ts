import type { Page, Site, } from "lume/core.ts";
import settings from "../src/_data/site.ts";

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

export default function registerPreprocessors(site: Site,) {
  site.preprocess([".md",], (pages: Page[],) => {
    for (const page of pages) {
      if (page.src.path.startsWith("/notes/",) || page.data.type === "note") {
        if (typeof page.data.content === "string") {
          const rawContent = page.data.content;
          const images = extractImagesFromNote(rawContent,);

          if (images.length > 0) {
            page.data.images = images;
            page.data.content = rawContent.replace(
              /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
              "",
            ).trim();
          }
        }
        const stats = { likes: 0, reposts: 0, replies: 0, };
        const webmentions = page.data.webmentions as any;

        if (webmentions && Array.isArray(webmentions.children,)) {
          const siteUrl = settings.url;
          const pageUrl = (siteUrl + page.data.url).replace(/\/+$/, "",);

          const relevantMentions = webmentions.children.filter(
            (entry: any,) => {
              const target = (entry["wm-target"] || "").replace(/\/+$/, "",);
              return target === pageUrl;
            },
          );

          stats.likes = relevantMentions.filter(
            (m: any,) => m["wm-property"] === "like-of",
          ).length;

          stats.reposts = relevantMentions.filter(
            (m: any,) => m["wm-property"] === "repost-of",
          ).length;

          stats.replies = relevantMentions.filter((m: any,) =>
            ["mention-of", "in-reply-to",].includes(m["wm-property"],)
          ).length;
        }

        page.data.stats = stats;
      }
    }
  },);
}
