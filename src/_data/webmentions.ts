/**
 * src/_data/webmentions.ts
 *
 * Webmentions Data Fetcher
 * Uses native Deno HTTP Cache API and simplified state management.
 */

import "@std/dotenv/load";
import { join } from "@std/path";
import { loadState, saveState, sortObjectKeys } from "../../utils/cache.ts";
import { HttpClient } from "../../utils/fetch-base.ts";
import type {
  Webmention,
  WebmentionApiResponse,
  WebmentionFeed,
} from "../types/index.ts";
import site from "./site.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  perPage: 1000,
  rateLimitMs: 1000,

  paths: {
    cacheFile: join(Deno.cwd(), "_cache", "webmentions_store.json"),
  },

  api: {
    base: "https://webmention.io/api",
  },

  credentials: {
    token: Deno.env.get("WEBMENTION_IO_TOKEN"),
    host: site.host,
  },

  userAgent: "ege.celikci.me/1.0 (ege@celikci.me)",
} as const;

class WebmentionFetcher {
  constructor(private httpClient: HttpClient) {}

  async fetchNew(since?: string | null): Promise<Webmention[]> {
    const { token, host } = CONFIG.credentials;

    if (!host || !token) {
      console.warn(
        "[webmentions] ⚠️ Missing configuration (HOST or TOKEN). Skipping fetch.",
      );
      return [];
    }

    const url = this.buildUrl(host, token, since);
    const sinceLabel = since
      ? new Date(since).toLocaleDateString()
      : "the beginning";

    console.log(`[webmentions] 🌐 Checking for updates since ${sinceLabel}...`);

    const data = await this.httpClient.fetch<WebmentionApiResponse>(
      url,
      "json",
      "force-cache",
    );

    if (!data?.children) return [];

    const count = data.children.length;
    if (count > 0) {
      console.log(
        `[webmentions] ✅ Fetched ${count} new webmention${
          count === 1 ? "" : "s"
        }`,
      );
    } else {
      console.log("[webmentions] ℹ️ No new webmentions found");
    }

    return data.children;
  }

  private buildUrl(
    host: string,
    token: string,
    since?: string | null,
  ): string {
    let url =
      `${CONFIG.api.base}/mentions.jf2?domain=${host}&token=${token}&per-page=${CONFIG.perPage}`;
    if (since) url += `&since=${encodeURIComponent(since)}`;
    return url;
  }
}

// ============================================================================
// WEBMENTION PROCESSOR
// ============================================================================

class WebmentionProcessor {
  mergeMentions(
    existing: Webmention[],
    incoming: Webmention[],
  ): Webmention[] {
    if (incoming.length === 0) return existing;

    console.log(
      `[webmentions] ♻️ Merging ${incoming.length} new entries with ${existing.length} existing...`,
    );

    const byId = new Map<number, Webmention>(
      existing.map((m) => [m["wm-id"], m]),
    );

    let added = 0;
    let updated = 0;

    for (const mention of incoming) {
      const prior = byId.get(mention["wm-id"]);
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(mention)) {
          byId.set(mention["wm-id"], mention);
          updated++;
        }
      } else {
        byId.set(mention["wm-id"], mention);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      console.log(
        `[webmentions] ℹ️ Added ${added} new, updated ${updated} existing mention${
          added + updated === 1 ? "" : "s"
        }`,
      );
    }

    return Array.from(byId.values()).sort((a, b) => {
      return (
        new Date(b["wm-received"]).getTime() -
        new Date(a["wm-received"]).getTime()
      );
    });
  }

  validateMention(mention: Webmention): boolean {
    return !!(
      mention["wm-id"] &&
      mention["wm-received"] &&
      mention["wm-property"] &&
      mention["wm-source"] &&
      mention["wm-target"]
    );
  }

  filterInvalid(mentions: Webmention[]): Webmention[] {
    const valid = mentions.filter((m) => this.validateMention(m));
    const dropped = mentions.length - valid.length;
    if (dropped > 0) {
      console.warn(
        `[webmentions] ⚠️ Filtered out ${dropped} invalid mention${
          dropped === 1 ? "" : "s"
        }`,
      );
    }
    return valid;
  }

  getStatsByType(mentions: Webmention[]): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const mention of mentions) {
      const type = mention["wm-property"];
      if (type) stats[type] = (stats[type] ?? 0) + 1;
    }
    return stats;
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function getWebmentionsData(): Promise<WebmentionFeed> {
  const startTime = performance.now();
  console.log("[webmentions] ℹ️ Starting webmentions sync...");

  const httpClient = new HttpClient({
    userAgent: CONFIG.userAgent,
    rateLimitMs: CONFIG.rateLimitMs,
    cacheName: "webmentions-api-cache",
  });

  const fetcher = new WebmentionFetcher(httpClient);
  const processor = new WebmentionProcessor();

  try {
    const cachedFeed = await loadState<WebmentionFeed>(CONFIG.paths.cacheFile, {
      children: [],
      lastFetched: null,
    });

    if (!CONFIG.credentials.token) {
      console.warn(
        "[webmentions] ⚠️ No token configured, returning cached data only",
      );
      return cachedFeed;
    }

    const newMentions = await fetcher.fetchNew(cachedFeed.lastFetched);

    if (newMentions.length === 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[webmentions] ✅ Completed in ${elapsed}s (no updates)`);
      return cachedFeed;
    }

    const validMentions = processor.filterInvalid(newMentions);
    const mergedMentions = processor.mergeMentions(
      cachedFeed.children,
      validMentions,
    );

    const updatedFeed: WebmentionFeed = {
      children: mergedMentions,
      lastFetched: new Date().toISOString(),
    };

    await saveState(CONFIG.paths.cacheFile, updatedFeed);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    const typeStats = processor.getStatsByType(mergedMentions);

    console.log(`[webmentions] ✅ Completed in ${elapsed}s`);
    console.log(
      `[webmentions] ℹ️ Total: ${mergedMentions.length} webmentions ` +
        `(${typeStats["like-of"] ?? 0} likes, ` +
        `${typeStats["repost-of"] ?? 0} reposts, ` +
        `${typeStats["in-reply-to"] ?? 0} replies, ` +
        `${typeStats["mention-of"] ?? 0} mentions)`,
    );

    return updatedFeed;
  } catch (error) {
    console.error(
      "[webmentions] ❌ Fatal error during webmentions sync:",
      (error as Error).message,
    );
    return { children: [], lastFetched: null };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default await getWebmentionsData();
