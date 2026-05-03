/**
 * utils/preprocessors/stats.ts
 * Processes Webmention statistics for pages.
 */

import type { Page, Site } from "lume/core.ts";
import { site as settings } from "../../_config/metadata.ts";

function normalizeUrl(url: string) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export default function () {
  return (site: Site) => {
    site.preprocess([".md"], (pages: Page[]) => {
      for (const page of pages) {
        const pageUrl = page.data.url as string;
        if (!pageUrl) continue;

        // Webmention stats logic
        const stats = { likes: 0, reposts: 0, replies: 0 };
        const webmentions = page.data.webmentions as any;

        if (webmentions?.children?.length) {
          const siteUrl = settings.url;
          const absPageUrl = normalizeUrl(siteUrl + pageUrl);

          const relevantMentions = webmentions.children.filter(
            (entry: any) =>
              normalizeUrl(entry["wm-target"] || "") === absPageUrl,
          );

          stats.likes = relevantMentions.filter((m: any) =>
            m["wm-property"] === "like-of"
          ).length;
          stats.reposts = relevantMentions.filter((m: any) =>
            m["wm-property"] === "repost-of"
          ).length;
          stats.replies = relevantMentions.filter((m: any) =>
            ["mention-of", "in-reply-to"].includes(m["wm-property"])
          ).length;
        }

        page.data.stats = stats;
      }
    });
  };
}
