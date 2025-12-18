import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import { unionBy, } from "lodash-es";
import { cachedFetch, } from "../../utils/cache.ts";
import settings from "./site.ts";

// Önbellek dizini ve dosya yolu
const CACHE_DIR = "_cache";
const CACHE_FILE = join(CACHE_DIR, "webmentions.json",);
const API = "https://webmention.io/api";
const WEBMENTION_IO_TOKEN = Deno.env.get("WEBMENTION_IO_TOKEN",);

// Host ayarını güvenli bir şekilde al
const host = settings?.host;

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

// Dosya varlık kontrolü için yardımcı fonksiyon
async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

async function fetchWebmentions(
  since?: string | null,
  perPage = 10000,
): Promise<WebmentionFeed | null> {
  if (!host || !WEBMENTION_IO_TOKEN) {
    console.warn(
      ">>> unable to fetch webmentions: missing host or WEBMENTION_IO_TOKEN",
    );
    return null;
  }

  let url =
    `${API}/mentions.jf2?domain=${host}&token=${WEBMENTION_IO_TOKEN}&per-page=${perPage}`;
  if (since) url += `&since=${since}`;

  try {
    // cachedFetch kullanıyoruz ancak duration: "0s" vererek her zaman taze veri çekmeyi zorluyoruz.
    // Kalıcı önbellekleme (merging) işlemini bu dosya kendisi yönetiyor.
    const feed = await cachedFetch(url, {
      duration: "0s",
      type: "json",
      headers: {
        "User-Agent": `${host} (via Lume)`,
      },
    },);

    console.log(
      `>>> ${
        feed.children ? feed.children.length : 0
      } new webmentions fetched from ${API}`,
    );
    return feed as WebmentionFeed;
  } catch (e) {
    console.error(">>> Error fetching webmentions:", e,);
    return null;
  }
}

// Yeni ve eski webmention'ları wm-id'ye göre birleştir
function mergeWebmentions(a: WebmentionFeed, b: WebmentionFeed,): Webmention[] {
  return unionBy(b.children, a.children, "wm-id",); // b (yeni) öncelikli olsun
}

// Birleştirilmiş veriyi dosyaya yaz
async function writeToCache(data: WebmentionFeed,) {
  await ensureDir(CACHE_DIR,);
  await Deno.writeTextFile(CACHE_FILE, JSON.stringify(data, null, 2,),);
  console.log(`>>> webmentions saved to ${CACHE_FILE}`,);
}

// Önbellekten veriyi oku
async function readFromCache(): Promise<WebmentionFeed> {
  if (await fileExists(CACHE_FILE,)) {
    try {
      const cacheFile = await Deno.readTextFile(CACHE_FILE,);
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
  const cache = await readFromCache();

  if (cache.children.length) {
    console.log(`>>> ${cache.children.length} webmentions loaded from cache`,);
  }

  // Token varsa yeni verileri kontrol et
  if (WEBMENTION_IO_TOKEN) {
    const feed = await fetchWebmentions(cache.lastFetched,);

    if (feed && feed.children && feed.children.length) {
      const webmentions = {
        lastFetched: new Date().toISOString(),
        children: mergeWebmentions(cache, feed,),
      };

      await writeToCache(webmentions,);
      return webmentions;
    }
  }

  return cache;
}

export default await getWebmentionsData();
