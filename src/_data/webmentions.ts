/**
 * Webmentions for the build, synced incrementally from webmention.io into `_cache/webmentions_store.json`.
 * @module
 */

import "@std/dotenv/load";
import { join } from "@std/path";
import { loadState, saveState } from "../../utils/cache.ts";
import { WebmentionFeedSchema } from "../../utils/schemas.ts";
import { type FetchPage, syncWebmentions } from "../../utils/webmentions.ts";
import type { WebmentionFeed } from "../types/index.ts";
import site from "./site.ts";

const CACHE_FILE = join(Deno.cwd(), "_cache", "webmentions_store.json");
const API = "https://webmention.io/api/mentions.jf2";
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

/**
 * Fetch one page straight from the network.
 *
 * The HTTP client's on-disk cache is skipped on purpose: it would replay a stale page forever and store the token in its URL.
 */
function pageFetcher(token: string, domain: string): FetchPage {
  return async (params) => {
    params.set("domain", domain);
    params.set("token", token);
    try {
      const res = await fetch(`${API}?${params}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        console.warn(`[webmentions] ⚠️ HTTP ${res.status}`);
        await res.body?.cancel();
        return null;
      }
      return await res.json();
    } catch (error) {
      console.warn(`[webmentions] ⚠️ ${(error as Error).name}`);
      return null;
    }
  };
}

async function getWebmentionsData(): Promise<WebmentionFeed> {
  const stored = await loadState<WebmentionFeed>(
    CACHE_FILE,
    { schemaVersion: 1, children: [], lastFetched: null },
    WebmentionFeedSchema,
  );

  const token = Deno.env.get("WEBMENTION_IO_TOKEN");
  if (!token || !site.host) {
    console.warn("[webmentions] ⚠️ No token configured, using the cache");
    return stored;
  }

  try {
    const result = await syncWebmentions(stored, pageFetcher(token, site.host));
    if (result.dropped > 0) {
      console.warn(
        `[webmentions] ⚠️ Skipped ${result.dropped} unsupported or malformed mentions`,
      );
    }
    if (result.feed === stored) {
      console.log("[webmentions] ℹ️ No new webmentions");
      return stored;
    }
    await saveState(CACHE_FILE, result.feed, WebmentionFeedSchema);
    console.log(
      `[webmentions] ✅ Added ${result.added}, updated ${result.updated}; ${result.feed.children.length} total`,
    );
    return result.feed;
  } catch (error) {
    console.warn(
      `[webmentions] ⚠️ Sync failed, keeping the cache: ${
        (error as Error).message
      }`,
    );
    return stored;
  }
}

export default await getWebmentionsData();
