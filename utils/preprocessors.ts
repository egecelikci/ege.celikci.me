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
  site.preprocess([".md", ".vto",], (pages: Page[],) => {
    // --- GRAPH SETUP ---
    // 1. Create maps for quick lookup
    const titleToUrl = new Map<string, string>();
    const urlToPage = new Map<string, any>();

    // --- PASS 1: Process Notes & Initialize Graph Data ---
    for (const page of pages) {
      // A. NOTE LOGIC (Images & Stats)
      if (page.src.path.startsWith("/notes/",) || page.data.type === "note") {
        if (typeof page.data.content === "string") {
          const rawContent = page.data.content;
          const images = extractImagesFromNote(rawContent,);

          if (images.length > 0) {
            page.data.images = images;
            page.data.content = rawContent
              .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, "",)
              .trim();
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

      // B. GRAPH INIT LOGIC
      if (page.data.title) {
        titleToUrl.set(page.data.title.toLowerCase(), page.data.url as string,);
        urlToPage.set(page.data.url as string, page,);
      }

      // Initialize backlinks array if it doesn't exist
      if (!page.data.backlinks) {
        page.data.backlinks = [];
      }
    }

    // --- PASS 2: Scan for Wikilinks & Build Graph ---
    const wikilinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;

    for (const sourcePage of pages) {
      // Use data.content (which might have been cleaned up in Pass 1)
      const content = sourcePage.data.content as string;
      if (typeof content !== "string") continue;

      const matches = content.matchAll(wikilinkRegex,);

      for (const match of matches) {
        const targetTitle = match[1].toLowerCase();
        const targetUrl = titleToUrl.get(targetTitle,);

        if (targetUrl) {
          const targetPage = urlToPage.get(targetUrl,);

          // Avoid self-references
          if (sourcePage.data.url === targetUrl) continue;

          // Avoid duplicates
          const isDuplicate = targetPage.data.backlinks.some(
            (link: any,) => link.url === sourcePage.data.url,
          );

          if (!isDuplicate) {
            // Push the SOURCE page into the TARGET's backlinks
            targetPage.data.backlinks.push({
              title: sourcePage.data.title,
              url: sourcePage.data.url,
              date: sourcePage.data.date,
              excerpt: sourcePage.data.description || "No description",
            },);
          }
        }
      }
    }
  },);
}
