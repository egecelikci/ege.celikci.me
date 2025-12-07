import Fetch from "@11ty/eleventy-fetch";
import { unionBy, } from "lodash-es";
import fs from "node:fs";
import path from "node:path";
import settings from "./site.ts";

// Define Cache Location and API Endpoint
const CACHE_DIR = ".cache";
const CACHE_FILE = path.join(CACHE_DIR, "webmentions.json",);
const API = "https://webmention.io/api";
const WEBMENTION_IO_TOKEN = Deno.env.get("WEBMENTION_IO_TOKEN",);
const { host, } = settings;

interface Webmention {
  "wm-id": number;
  "wm-property": string;
  "wm-source": string;
  "wm-target": string;
  "wm-received": string;
  author: {
    name: string;
    url: string;
    photo: string;
  };
  url?: string;
  published?: string;
  content?: {
    html?: string;
    text?: string;
    value?: string;
  };
  [key: string]: unknown;
}

interface WebmentionFeed {
  children: Webmention[];
  lastFetched?: string | null;
}

async function fetchWebmentions(
  since?: string | null,
  perPage = 10000,
): Promise<WebmentionFeed | null> {
  if (!host || !WEBMENTION_IO_TOKEN) {
    console.warn(">>> unable to fetch webmentions: missing host or token",);
    return null;
  }

  let url =
    `${API}/mentions.jf2?domain=${host}&token=${WEBMENTION_IO_TOKEN}&per-page=${perPage}`;
  if (since) url += `&since=${since}`;

  try {
    // Use duration: "0s" to ensure we always check for *new* updates (incremental fetch).
    // We manage the long-term persistence manually in the file cache.
    const feed = await Fetch(url, {
      duration: "0s",
      type: "json",
      fetchOptions: {
        headers: {
          "User-Agent": "ege.celikci.me/1.0 ( ege@celikci.me )",
        },
      },
    },);

    console.log(
      `>>> ${(
        feed.children ? feed.children.length : 0
      )} new webmentions fetched from ${API}`,
    );
    return feed;
  } catch (e) {
    console.error(">>> Error fetching webmentions:", e,);
    return null;
  }
}

// Merge fresh webmentions with cached entries, unique per id
function mergeWebmentions(a: WebmentionFeed, b: WebmentionFeed,): Webmention[] {
  return unionBy(a.children, b.children, "wm-id",);
}

// save combined webmentions in cache file
function writeToCache(data: WebmentionFeed,) {
  if (!fs.existsSync(CACHE_DIR,)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true, },);
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2,),);
  console.log(`>>> webmentions saved to ${CACHE_FILE}`,);
}

// get cache contents from json file
function readFromCache(): WebmentionFeed {
  if (fs.existsSync(CACHE_FILE,)) {
    try {
      const cacheFile = fs.readFileSync(CACHE_FILE, "utf-8",);
      return JSON.parse(cacheFile,);
    } catch (e) {
      console.error(">>> Error reading webmentions cache:", e,);
    }
  }

  return {
    lastFetched: null,
    children: [],
  };
}

async function getWebmentionsData(): Promise<WebmentionFeed> {
  const cache = readFromCache();

  if (cache.children.length) {
    console.log(`>>> ${cache.children.length} webmentions loaded from cache`,);
  }

  const feed = await fetchWebmentions(cache.lastFetched,);

  if (feed && feed.children && feed.children.length) {
    const webmentions = {
      lastFetched: new Date().toISOString(),
      children: mergeWebmentions(cache, feed,),
    };

    writeToCache(webmentions,);
    return webmentions;
  }

  return cache;
}

export default await getWebmentionsData();
