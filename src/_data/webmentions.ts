/**
 * Webmentions Data File
 *
 * This file acts as the primary data source for "webmentions" in Lume.
 * It handles:
 * 1. Loading cached mentions from a persistent file (in _cache).
 * 2. Fetching new mentions from webmention.io.
 * 3. Merging and saving the updated list back to the cache.
 * 4. Returning the final data object to Lume.
 */

import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import { unionBy, } from "npm:lodash-es@4.17.22";
import fetch from "npm:make-fetch-happen";
import type { WebmentionFeed, } from "../types/index.ts";
import settings from "./site.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

// 1. Internal Persistence: Store the data in _cache so Lume doesn't try to load it twice
//    or get stuck in a rebuild loop.
const CACHE_DIR = join(Deno.cwd(), "_cache",);
const CACHE_FILE = join(CACHE_DIR, "webmentions_store.json",);

// 2. HTTP Cache for the fetch client itself
const HTTP_CACHE_PATH = join(Deno.cwd(), "_cache", "webmentions_api",);

const API_BASE = "https://webmention.io/api";
const TOKEN = Deno.env.get("WEBMENTION_IO_TOKEN",);
const HOST = settings?.host;
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

// ============================================================================
// CORE LOGIC
// ============================================================================

async function fetchNewWebmentions(
  since?: string | null,
): Promise<WebmentionFeed | null> {
  if (!HOST || !TOKEN) {
    console.warn("[webmentions] ⚠ Missing config (HOST or TOKEN). Skipping.",);
    return null;
  }

  let url =
    `${API_BASE}/mentions.jf2?domain=${HOST}&token=${TOKEN}&per-page=1000`;
  if (since) url += `&since=${since}`;

  try {
    const response = await fetch(url, {
      cachePath: HTTP_CACHE_PATH,
      cache: "no-cache", // Check for updates, don't serve stale API responses
      retry: { retries: 2, minTimeout: 1000, },
      headers: {
        "User-Agent": USER_AGENT,
      },
    },);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
    }

    const data = (await response.json()) as WebmentionFeed;
    const count = data.children ? data.children.length : 0;

    if (count > 0) {
      console.log(`[webmentions] ✓ Fetched ${count} new entries from API`,);
    }

    return data;
  } catch (error) {
    console.error(`[webmentions] ✗ API Error: ${(error as Error).message}`,);
    return null;
  }
}

// ============================================================================
// PERSISTENCE (Cache Layer)
// ============================================================================

async function readLocalCache(): Promise<WebmentionFeed> {
  try {
    const text = await Deno.readTextFile(CACHE_FILE,);
    return JSON.parse(text,);
  } catch {
    // Start fresh if no cache exists
    return { children: [], lastFetched: null, };
  }
}

async function saveLocalCache(data: WebmentionFeed,) {
  try {
    await ensureDir(CACHE_DIR,);
    await Deno.writeTextFile(CACHE_FILE, JSON.stringify(data, null, 2,),);
  } catch (error) {
    console.error(
      `[webmentions] ⚠ Failed to save cache: ${(error as Error).message}`,
    );
  }
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

async function getWebmentionsData(): Promise<WebmentionFeed> {
  // 1. Load history from _cache
  const localData = await readLocalCache();

  if (!TOKEN) {
    return localData;
  }

  // 2. Fetch updates
  console.log(
    `[webmentions] Checking for updates since ${
      localData.lastFetched || "beginning"
    }...`,
  );

  const newData = await fetchNewWebmentions(localData.lastFetched,);

  if (newData && newData.children && newData.children.length > 0) {
    console.log(
      `[webmentions] ♻ Merging ${newData.children.length} new entries...`,
    );

    // 3. Merge new data with history
    const mergedChildren = unionBy(
      newData.children,
      localData.children,
      "wm-id",
    );

    const finalData: WebmentionFeed = {
      children: mergedChildren,
      lastFetched: new Date().toISOString(),
    };

    // 4. Save to _cache for next time
    await saveLocalCache(finalData,);

    // 5. Return updated data to Lume
    return finalData;
  }

  console.log("[webmentions] ✓ No new entries.",);
  // Return existing data to Lume
  return localData;
}

// Lume waits for the promise to resolve and uses the result as the "webmentions" data
export default await getWebmentionsData();
