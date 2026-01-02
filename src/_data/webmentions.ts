/**
 * Webmentions Data Fetcher
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import fetch from "npm:make-fetch-happen@15.0.3";
import { createCache, objectValidator, } from "../../utils/cache.ts";
import type {
  Webmention,
  WebmentionApiResponse,
  WebmentionFeed,
} from "../types/index.ts";
import settings from "./site.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  perPage: 1000,
  retryConfig: { retries: 2, minTimeout: 1000, },

  paths: {
    cacheFile: join(Deno.cwd(), "_cache", "webmentions_store.json",),
    httpCache: join(Deno.cwd(), "_cache", "webmentions_api",),
  },

  api: {
    base: "https://webmention.io/api",
  },

  credentials: {
    token: Deno.env.get("WEBMENTION_IO_TOKEN",),
    host: settings?.host,
  },

  userAgent: "ege.celikci.me/1.0 (ege@celikci.me)",
} as const;

// ============================================================================
// LOGGING
// ============================================================================

class Logger {
  private static readonly PREFIX = "[webmentions]";
  private static readonly ICONS = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    fetch: "🌐",
    cache: "💾",
    merge: "♻️",
  } as const;

  static info(msg: string,) {
    console.log(`${this.PREFIX} ${this.ICONS.info} ${msg}`,);
  }

  static success(msg: string,) {
    console.log(`${this.PREFIX} ${this.ICONS.success} ${msg}`,);
  }

  static warn(msg: string,) {
    console.warn(`${this.PREFIX} ${this.ICONS.warning} ${msg}`,);
  }

  static error(msg: string, error?: unknown,) {
    const errorMsg = error instanceof Error ? error.message : String(error,);
    console.error(
      `${this.PREFIX} ${this.ICONS.error} ${msg}${
        error ? `: ${errorMsg}` : ""
      }`,
    );
  }

  static fetch(msg: string,) {
    console.log(`${this.PREFIX} ${this.ICONS.fetch} ${msg}`,);
  }

  static merge(msg: string,) {
    console.log(`${this.PREFIX} ${this.ICONS.merge} ${msg}`,);
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

class HttpClient {
  private apiCallCount = 0;
  private errorCount = 0;

  async fetch(url: string,): Promise<WebmentionApiResponse | null> {
    try {
      this.apiCallCount++;

      const response = await fetch(url, {
        cachePath: CONFIG.paths.httpCache,
        cache: "no-cache", // Always check for fresh data
        retry: CONFIG.retryConfig,
        headers: {
          "User-Agent": CONFIG.userAgent,
        },
      },);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
      }

      const data = await response.json() as WebmentionApiResponse;
      return data;
    } catch (error) {
      this.errorCount++;
      Logger.error("API request failed", error,);
      return null;
    }
  }

  getStats() {
    return {
      apiCalls: this.apiCallCount,
      errors: this.errorCount,
    };
  }
}

// ============================================================================
// WEBMENTION FETCHER
// ============================================================================

class WebmentionFetcher {
  constructor(private httpClient: HttpClient,) {}

  async fetchNew(since?: string | null,): Promise<Webmention[]> {
    const { token, host, } = CONFIG.credentials;

    if (!host || !token) {
      Logger.warn("Missing configuration (HOST or TOKEN). Skipping fetch.",);
      return [];
    }

    const url = this.buildUrl(host, token, since,);
    const sinceLabel = since
      ? new Date(since,).toLocaleDateString()
      : "the beginning";

    Logger.fetch(`Checking for updates since ${sinceLabel}...`,);

    const data = await this.httpClient.fetch(url,);

    if (!data || !data.children) {
      return [];
    }

    const count = data.children.length;

    if (count > 0) {
      Logger.success(
        `Fetched ${count} new webmention${count === 1 ? "" : "s"}`,
      );
    } else {
      Logger.info("No new webmentions found",);
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

    if (since) {
      url += `&since=${encodeURIComponent(since,)}`;
    }

    return url;
  }
}

// ============================================================================
// WEBMENTION PROCESSOR
// ============================================================================

class WebmentionProcessor {
  mergeMentions(
    existingMentions: Webmention[],
    newMentions: Webmention[],
  ): Webmention[] {
    if (newMentions.length === 0) {
      return existingMentions;
    }

    Logger.merge(
      `Merging ${newMentions.length} new entries with ${existingMentions.length} existing...`,
    );

    // Create a map of existing mentions for O(1) lookup
    const mentionMap = new Map<number, Webmention>();

    for (const mention of existingMentions) {
      mentionMap.set(mention["wm-id"], mention,);
    }

    // Add or update mentions
    let addedCount = 0;
    let updatedCount = 0;

    for (const mention of newMentions) {
      const existingMention = mentionMap.get(mention["wm-id"],);

      if (existingMention) {
        // Check if the new version is different (updated)
        if (JSON.stringify(existingMention,) !== JSON.stringify(mention,)) {
          mentionMap.set(mention["wm-id"], mention,);
          updatedCount++;
        }
      } else {
        mentionMap.set(mention["wm-id"], mention,);
        addedCount++;
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      Logger.info(
        `Added ${addedCount} new, updated ${updatedCount} existing mention${
          addedCount + updatedCount === 1 ? "" : "s"
        }`,
      );
    }

    // Convert back to array and sort by received date (newest first)
    return Array.from(mentionMap.values(),).sort((a, b,) => {
      const dateA = new Date(a["wm-received"],).getTime();
      const dateB = new Date(b["wm-received"],).getTime();
      return dateB - dateA;
    },);
  }

  validateMention(mention: Webmention,): boolean {
    // Basic validation
    if (!mention["wm-id"] || !mention["wm-received"]) {
      return false;
    }

    // Ensure required fields are present
    if (
      !mention["wm-property"] || !mention["wm-source"] || !mention["wm-target"]
    ) {
      return false;
    }

    return true;
  }

  filterInvalid(mentions: Webmention[],): Webmention[] {
    const valid = mentions.filter((m,) => this.validateMention(m,));
    const invalid = mentions.length - valid.length;

    if (invalid > 0) {
      Logger.warn(
        `Filtered out ${invalid} invalid mention${invalid === 1 ? "" : "s"}`,
      );
    }

    return valid;
  }

  getStatsByType(mentions: Webmention[],): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const mention of mentions) {
      const type = mention["wm-property"];
      stats[type] = (stats[type] || 0) + 1;
    }

    return stats;
  }
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function getWebmentionsData(): Promise<WebmentionFeed> {
  const startTime = performance.now();
  Logger.info("Starting webmentions sync...",);

  // Initialize components
  const httpClient = new HttpClient();
  const fetcher = new WebmentionFetcher(httpClient,);
  const processor = new WebmentionProcessor();

  // Use shared cache manager
  const cache = createCache<WebmentionFeed>({
    filePath: CONFIG.paths.cacheFile,
    name: "webmentions",
    validator: objectValidator(["children",],),
  },);

  try {
    // Load cached data
    const cachedFeed = await cache.load({
      children: [],
      lastFetched: null,
    },);

    // Skip fetch if no token configured
    if (!CONFIG.credentials.token) {
      Logger.warn("No token configured, returning cached data only",);
      return cachedFeed;
    }

    // Fetch new mentions
    const newMentions = await fetcher.fetchNew(cachedFeed.lastFetched,);

    // If no new mentions, return cached data
    if (newMentions.length === 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
      Logger.success(`Completed in ${elapsed}s (no updates)`,);
      return cachedFeed;
    }

    // Validate new mentions
    const validMentions = processor.filterInvalid(newMentions,);

    // Merge with existing mentions
    const mergedMentions = processor.mergeMentions(
      cachedFeed.children,
      validMentions,
    );

    // Create updated feed
    const updatedFeed: WebmentionFeed = {
      children: mergedMentions,
      lastFetched: new Date().toISOString(),
    };

    // Save to cache
    await cache.save(updatedFeed,);

    // Report stats
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
    const httpStats = httpClient.getStats();
    const typeStats = processor.getStatsByType(mergedMentions,);

    Logger.success(`Completed in ${elapsed}s`,);
    Logger.info(
      `Total: ${mergedMentions.length} webmentions `
        + `(${typeStats["like-of"] || 0} likes, `
        + `${typeStats["repost-of"] || 0} reposts, `
        + `${typeStats["in-reply-to"] || 0} replies, `
        + `${typeStats["mention-of"] || 0} mentions)`,
    );
    Logger.info(
      `HTTP: ${httpStats.apiCalls} API calls, ${httpStats.errors} errors`,
    );

    return updatedFeed;
  } catch (error) {
    Logger.error("Fatal error during webmentions sync", error,);

    // Fallback to cached data
    const cachedFeed = cache.get();
    if (cachedFeed && cachedFeed.children.length > 0) {
      Logger.warn(
        `Returning ${cachedFeed.children.length} cached webmentions as fallback`,
      );
      return cachedFeed;
    }

    // Return empty feed if no cache available
    Logger.warn("No cached data available, returning empty feed",);
    return { children: [], lastFetched: null, };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default await getWebmentionsData();
