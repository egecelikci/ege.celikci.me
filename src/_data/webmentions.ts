import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import { unionBy, } from "npm:lodash-es@4.17.22";
import { DataService, } from "../services/DataService.ts";
import type { Webmention, WebmentionFeed, } from "../types/index.ts";
import settings from "./site.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_DIR = "./_cache";
const CACHE_FILE = join(CACHE_DIR, "webmentions.json",);
const API_BASE = "https://webmention.io/api";
const TOKEN = Deno.env.get("WEBMENTION_IO_TOKEN",);
const HOST = settings?.host;
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

// Initialize DataService
const dataService = new DataService(CACHE_DIR,);

// ============================================================================
// HELPERS
// ============================================================================

async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// FETCHING
// ============================================================================

async function fetchWebmentions(
  since?: string | null,
  perPage = 10000,
): Promise<WebmentionFeed | null> {
  if (!HOST || !TOKEN) {
    console.warn(
      "[webmentions.ts] ⚠ Missing config: host or WEBMENTION_IO_TOKEN",
    );
    return null;
  }

  let url =
    `${API_BASE}/mentions.jf2?domain=${HOST}&token=${TOKEN}&per-page=${perPage}`;
  if (since) url += `&since=${since}`;

  try {
    // We use duration: "0s" to force checking for new data.
    // However, DataService will still cache this specific request (URL + since param)
    // which helps if you rebuild strictly within the same timeframe without new data.
    const result = await dataService.fetch<WebmentionFeed>(url, {
      duration: "0s",
      gracefulFallback: false, // If the API fails, we want to know so we don't update the timestamp
      headers: {
        "User-Agent": USER_AGENT,
      },
    },);

    const count = result.data.children ? result.data.children.length : 0;
    console.log(`[webmentions.ts] ✓ Fetched ${count} new entries`,);

    return result.data;
  } catch (e) {
    console.error(`[webmentions.ts] ✗ Fetch failed: ${(e as Error).message}`,);
    return null;
  }
}

// ============================================================================
// CACHE MANAGEMENT (AGGREGATION)
// ============================================================================

function mergeWebmentions(a: WebmentionFeed, b: WebmentionFeed,): Webmention[] {
  // Union by wm-id, preferring 'b' (new data)
  return unionBy(b.children, a.children, "wm-id",);
}

async function writeToCache(data: WebmentionFeed,) {
  await ensureDir(CACHE_DIR,);
  await Deno.writeTextFile(CACHE_FILE, JSON.stringify(data, null, 2,),);
  console.log(`[webmentions.ts] Saved merged data to ${CACHE_FILE}`,);
}

async function readFromCache(): Promise<WebmentionFeed> {
  if (await fileExists(CACHE_FILE,)) {
    try {
      const cacheFile = await Deno.readTextFile(CACHE_FILE,);
      return JSON.parse(cacheFile,);
    } catch (e) {
      console.error("[webmentions.ts] ✗ Error reading cache:", e,);
    }
  }

  return {
    lastFetched: null,
    children: [],
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

async function getWebmentionsData(): Promise<WebmentionFeed> {
  const cache = await readFromCache();

  if (cache.children.length) {
    console.log(
      `[webmentions.ts] Loaded ${cache.children.length} entries from local cache`,
    );
  }

  // Only fetch if we have a token
  if (TOKEN) {
    const feed = await fetchWebmentions(cache.lastFetched,);

    if (feed && feed.children && feed.children.length) {
      console.log(
        `[webmentions.ts] Merging ${feed.children.length} new entries...`,
      );

      const webmentions: WebmentionFeed = {
        lastFetched: new Date().toISOString(),
        children: mergeWebmentions(cache, feed,),
      };

      await writeToCache(webmentions,);
      return webmentions;
    } else {
      console.log("[webmentions.ts] No new webmentions found.",);
    }
  }

  return cache;
}

export default await getWebmentionsData();
