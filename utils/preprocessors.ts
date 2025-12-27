import type { Page, Site, } from "lume/core.ts";
import settings from "../src/_data/site.ts";

interface Backlink {
  title: string;
  url: string;
  date: Date;
  excerpt: string;
}

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

function normalizeUrl(url: string,): string {
  if (!url) return "";
  return url.endsWith("/",) ? url.slice(0, -1,) : url;
}

export default function registerPreprocessors(site: Site,) {
  site.preprocess([".md", ".vto",], (pages: Page[],) => {
    // --- GRAPH SETUP ---
    const titleToUrl = new Map<string, string>();
    const urlToPage = new Map<string, Page>();

    // --- PASS 1: Initialize Data & Process Notes ---
    for (const page of pages) {
      const pageUrl = page.data.url as string;
      if (!pageUrl) continue;

      // A. NOTE LOGIC
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
          const absPageUrl = normalizeUrl(siteUrl + pageUrl,);

          const relevantMentions = webmentions.children.filter(
            (entry: any,) => {
              const target = normalizeUrl(entry["wm-target"] || "",);
              return target === absPageUrl;
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

      // B. BUILD LOOKUP MAPS
      if (page.data.title) {
        titleToUrl.set(page.data.title.toLowerCase(), pageUrl,);
      }
      urlToPage.set(normalizeUrl(pageUrl,), page,);

      if (!page.data.backlinks) {
        page.data.backlinks = [];
      }
    }

    // --- PASS 2: Scan Content for Links ---
    const wikilinkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
    const standardLinkRegex = /\[([^\]]+)\]\(([^)"]+)(?: "[^"]+")?\)/g;

    for (const sourcePage of pages) {
      const content = sourcePage.data.content as string;
      if (typeof content !== "string") continue;

      const foundUrls = new Set<string>();

      // 1. Find Wikilinks
      for (const match of content.matchAll(wikilinkRegex,)) {
        const targetTitle = match[1].toLowerCase();
        const targetUrl = titleToUrl.get(targetTitle,);
        if (targetUrl) foundUrls.add(targetUrl,);
      }

      // 2. Find Standard Links
      for (const match of content.matchAll(standardLinkRegex,)) {
        const rawUrl = match[2];
        if (rawUrl.startsWith("http",) || rawUrl.startsWith("#",)) continue;
        foundUrls.add(rawUrl,);
      }

      // 3. Process Links
      for (const rawTargetUrl of foundUrls) {
        const targetUrl = normalizeUrl(rawTargetUrl,);

        if (normalizeUrl(sourcePage.data.url as string,) === targetUrl) {
          continue;
        }

        const targetPage = urlToPage.get(targetUrl,);

        if (targetPage) {
          const backlinks = targetPage.data.backlinks as Backlink[];
          const isDuplicate = backlinks.some(
            (link,) => link.url === sourcePage.data.url,
          );

          if (!isDuplicate) {
            backlinks.push({
              title: sourcePage.data.title || "Untitled",
              url: sourcePage.data.url as string,
              date: sourcePage.data.date as Date,
              excerpt: sourcePage.data.description || "No description",
            },);
            backlinks.sort((a, b,) => b.date.getTime() - a.date.getTime());
          }
        }
      }
    }
  },);
}
