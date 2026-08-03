/**
 * utils/webmention-stats.ts
 * Pure helpers for computing webmention statistics for a page.
 * Kept free of side effects so they can be unit tested.
 */

import type { Webmention, WebmentionFeed } from "../src/types/index.ts";

/** Normalize a URL for comparison: strip trailing slashes. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export interface PageStats {
  likes: number;
  reposts: number;
  replies: number;
}

/** Compute like/repost/reply counts for a page URL, excluding own mentions. */
export function computeWebmentionStats(
  webmentions: WebmentionFeed | undefined,
  siteUrl: string,
  pageUrl: string,
  isOwnWebmention: (mention: Webmention) => boolean,
): PageStats {
  const stats: PageStats = { likes: 0, reposts: 0, replies: 0 };

  if (webmentions?.children?.length) {
    const absPageUrl = normalizeUrl(siteUrl + pageUrl);

    const relevantMentions = webmentions.children.filter(
      (entry: Webmention) =>
        normalizeUrl(entry["wm-target"] || "") === absPageUrl &&
        !isOwnWebmention(entry),
    );

    stats.likes = relevantMentions.filter((m) =>
      m["wm-property"] === "like-of"
    ).length;
    stats.reposts = relevantMentions.filter((m) =>
      m["wm-property"] === "repost-of"
    ).length;
    stats.replies =
      relevantMentions.filter((m) =>
        ["mention-of", "in-reply-to"].includes(m["wm-property"])
      ).length;
  }

  return stats;
}
