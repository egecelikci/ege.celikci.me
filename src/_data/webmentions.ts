/**
 * src/_data/webmentions.ts
 *
 * Webmentions Data Fetcher
 * Refactored to remove make-fetch-happen in favour of native Deno fetch
 * with a lightweight retry/timeout wrapper.
 */

import "@std/dotenv/load";
import { join, } from "@std/path";
import { createCache, objectValidator, } from "../../utils/cache.ts";
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
  retryConfig: { retries: 2, minTimeout: 1000, },
  timeoutMs: 10_000,

  paths: {
    cacheFile: join(Deno.cwd(), "_cache", "webmentions_store.json",),
  },

  api: {
    base: "https://webmention.io/api",
  },

  credentials: {
    token: Deno.env.get("WEBMENTION_IO_TOKEN",),
    host: site.host,
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
    const detail = error instanceof Error ? error.message : String(error,);
    console.error(
      `${this.PREFIX} ${this.ICONS.error} ${msg}${error ? `: ${detail}` : ""}`,
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
// ROBUST FETCH — replaces make-fetch-happen
// ============================================================================

/**
 * Wraps native fetch with:
 *  - AbortSignal.timeout() for a hard deadline on every attempt
 *  - Exponential-backoff retries on 5xx responses or network errors
 *  - No retry on 4xx (client errors are permanent)
 *
 * This replaces the `retry` and cache options previously supplied to
 * make-fetch-happen. The webmentions API always needs fresh data, so
 * no disk-level HTTP caching is implemented here.
 */
async function robustFetch(
  url: string,
  init: RequestInit = {},
  maxRetries = CONFIG.retryConfig.retries,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        // Hard timeout per attempt — prevents build hangs on slow networks
        signal: AbortSignal.timeout(CONFIG.timeoutMs,),
      },);

      // 4xx errors are permanent — no point retrying
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx: transient server failure, schedule a retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`,);
    } catch (err) {
      // Network failure or timeout: schedule a retry
      lastError = err;
    }

    if (attempt < maxRetries) {
      // Exponential backoff: 1 s → 2 s → 4 s …
      const delay = Math.min(
        CONFIG.retryConfig.minTimeout * Math.pow(2, attempt,),
        8_000,
      );
      await new Promise<void>((r,) => setTimeout(r, delay,));
    }
  }

  throw lastError;
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

      const response = await robustFetch(url, {
        headers: {
          "User-Agent": CONFIG.userAgent,
          Accept: "application/json",
        },
      },);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
      }

      return await response.json() as WebmentionApiResponse;
    } catch (error) {
      this.errorCount++;
      Logger.error("API request failed", error,);
      return null;
    }
  }

  getStats() {
    return { apiCalls: this.apiCallCount, errors: this.errorCount, };
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

    if (!data?.children) return [];

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
    if (since) url += `&since=${encodeURIComponent(since,)}`;
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

    Logger.merge(
      `Merging ${incoming.length} new entries with ${existing.length} existing...`,
    );

    // O(1) lookup by wm-id — avoids O(n²) array scanning
    // Mutate in-place rather than copying to stay memory-efficient on large sets
    const byId = new Map<number, Webmention>(
      existing.map((m,) => [m["wm-id"], m,]),
    );

    let added = 0;
    let updated = 0;

    for (const mention of incoming) {
      const prior = byId.get(mention["wm-id"],);
      if (prior) {
        // Only overwrite if the content actually changed
        if (JSON.stringify(prior,) !== JSON.stringify(mention,)) {
          byId.set(mention["wm-id"], mention,);
          updated++;
        }
      } else {
        byId.set(mention["wm-id"], mention,);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      Logger.info(
        `Added ${added} new, updated ${updated} existing mention${
          added + updated === 1 ? "" : "s"
        }`,
      );
    }

    return Array.from(byId.values(),).sort((a, b,) => {
      return (
        new Date(b["wm-received"],).getTime()
        - new Date(a["wm-received"],).getTime()
      );
    },);
  }

  validateMention(mention: Webmention,): boolean {
    return !!(
      mention["wm-id"]
      && mention["wm-received"]
      && mention["wm-property"]
      && mention["wm-source"]
      && mention["wm-target"]
    );
  }

  filterInvalid(mentions: Webmention[],): Webmention[] {
    const valid = mentions.filter((m,) => this.validateMention(m,));
    const dropped = mentions.length - valid.length;
    if (dropped > 0) {
      Logger.warn(
        `Filtered out ${dropped} invalid mention${dropped === 1 ? "" : "s"}`,
      );
    }
    return valid;
  }

  getStatsByType(mentions: Webmention[],): Record<string, number> {
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
  Logger.info("Starting webmentions sync...",);

  const httpClient = new HttpClient();
  const fetcher = new WebmentionFetcher(httpClient,);
  const processor = new WebmentionProcessor();

  const cache = createCache<WebmentionFeed>({
    filePath: CONFIG.paths.cacheFile,
    name: "webmentions",
    validator: objectValidator(["children",],),
  },);

  try {
    const cachedFeed = await cache.load({ children: [], lastFetched: null, },);

    if (!CONFIG.credentials.token) {
      Logger.warn("No token configured, returning cached data only",);
      return cachedFeed;
    }

    const newMentions = await fetcher.fetchNew(cachedFeed.lastFetched,);

    if (newMentions.length === 0) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
      Logger.success(`Completed in ${elapsed}s (no updates)`,);
      return cachedFeed;
    }

    const validMentions = processor.filterInvalid(newMentions,);
    const mergedMentions = processor.mergeMentions(
      cachedFeed.children,
      validMentions,
    );

    const updatedFeed: WebmentionFeed = {
      children: mergedMentions,
      lastFetched: new Date().toISOString(),
    };

    await cache.save(updatedFeed,);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
    const httpStats = httpClient.getStats();
    const typeStats = processor.getStatsByType(mergedMentions,);

    Logger.success(`Completed in ${elapsed}s`,);
    Logger.info(
      `Total: ${mergedMentions.length} webmentions `
        + `(${typeStats["like-of"] ?? 0} likes, `
        + `${typeStats["repost-of"] ?? 0} reposts, `
        + `${typeStats["in-reply-to"] ?? 0} replies, `
        + `${typeStats["mention-of"] ?? 0} mentions)`,
    );
    Logger.info(
      `HTTP: ${httpStats.apiCalls} API calls, ${httpStats.errors} errors`,
    );

    return updatedFeed;
  } catch (error) {
    Logger.error("Fatal error during webmentions sync", error,);

    const cachedFeed = cache.get();
    if (cachedFeed && cachedFeed.children.length > 0) {
      Logger.warn(
        `Returning ${cachedFeed.children.length} cached webmentions as fallback`,
      );
      return cachedFeed;
    }

    Logger.warn("No cached data available, returning empty feed",);
    return { children: [], lastFetched: null, };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default await getWebmentionsData();
