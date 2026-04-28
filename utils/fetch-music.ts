/**
 * Favorite Music Data Fetcher
 * Sorted by "Liked Date" (CritiqueBrainz review date)
 */

import "@std/dotenv/load";
import { ensureDir } from "@std/fs/ensure-dir";
import { join } from "@std/path";
import type {
  Album,
  CritiqueBrainzResponse,
  CritiqueBrainzReview,
  ProcessedAlbum,
} from "../src/types/index.ts";
import { createCache, objectValidator } from "./cache.ts";
import { ditherWithSharp, saveColorVersion } from "./images.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  syncMode: "mirror" as "append" | "mirror",
  fetchLimit: 50,
  maxConcurrentImages: 4, // CPU-bound
  maxConcurrentFastLane: 20, // Disk-bound
  maxConcurrentMetadata: 1, // Network-bound (MusicBrainz: strictly 1 req/s)
  rateLimitDelayMs: 1100,
  requestTimeoutMs: 15_000,
  retryConfig: { retries: 3, minTimeout: 1000, maxTimeout: 5000 },

  paths: {
    cache: join(Deno.cwd(), "_cache"),
    cacheFile: join(Deno.cwd(), "src", "_data", "music.json"),
    httpCache: join(Deno.cwd(), "_cache", "http-cache"),
    coverColor: "src/assets/images/covers/colored",
    coverMono: "src/assets/images/covers/monochrome",
  },

  api: {
    critiqueBrainz: "https://critiquebrainz.org/ws/1",
    musicBrainz: "https://musicbrainz.org/ws/2/release-group/",
    coverArt: "https://coverartarchive.org/release-group/",
  },

  credentials: {
    critiqueBrainzId: Deno.env.get("CRITIQUEBRAINZ_ID"),
  },
} as const;

// ============================================================================
// LOGGING
// ============================================================================

class Logger {
  private static readonly ICONS = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    network: "🌐",
    cache: "💾",
    process: "⚙️",
    music: "🎵",
    coldStart: "🧊",
    append: "➕",
  } as const;

  static info(msg: string) {
    console.log(`[music] ${this.ICONS.info} ${msg}`);
  }

  static success(msg: string) {
    console.log(`[music] ${this.ICONS.success} ${msg}`);
  }

  static warn(msg: string) {
    console.warn(`[music] ${this.ICONS.warning} ${msg}`);
  }

  static error(msg: string, error?: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[music] ${this.ICONS.error} ${msg}${error ? `: ${detail}` : ""}`,
    );
  }

  static progress(current: number, total: number, prefix = "Progress") {
    const pct = total > 0 ? ((current / total) * 100).toFixed(0) : "100";
    Deno.stdout.write(
      new TextEncoder().encode(
        `\r[music] ${prefix}: ${current}/${total} (${pct}%)`,
      ),
    );
    if (current === total) console.log("");
  }
}

// ============================================================================
// HELPERS
// ============================================================================

class RateLimiter {
  private lastRequestTime = 0;
  async enforceCooldown(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < CONFIG.rateLimitDelayMs) {
      await new Promise<void>((r) =>
        setTimeout(r, CONFIG.rateLimitDelayMs - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
  }
}

class SimpleFileCache {
  constructor(private readonly dir: string) {}
  private async urlToKey(url: string): Promise<string> {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(url),
    );
    return Array.from(new Uint8Array(buf)).map((b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }
  async getJson(url: string): Promise<unknown | null> {
    try {
      const key = await this.urlToKey(url);
      const text = await Deno.readTextFile(join(this.dir, `${key}.json`));
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  async setJson(url: string, data: unknown): Promise<void> {
    await ensureDir(this.dir);
    const key = await this.urlToKey(url);
    await Deno.writeTextFile(
      join(this.dir, `${key}.json`),
      JSON.stringify(data),
    );
  }
  async getBuffer(url: string): Promise<ArrayBuffer | null> {
    try {
      const key = await this.urlToKey(url);
      return (await Deno.readFile(join(this.dir, `${key}.bin`))).buffer;
    } catch {
      return null;
    }
  }
  async setBuffer(url: string, data: ArrayBuffer): Promise<void> {
    await ensureDir(this.dir);
    const key = await this.urlToKey(url);
    await Deno.writeFile(join(this.dir, `${key}.bin`), new Uint8Array(data));
  }
}

async function robustFetch(
  url: string,
  init: RequestInit = {},
  retries = CONFIG.retryConfig.retries,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(CONFIG.requestTimeoutMs),
      });
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) {
      const delay = Math.min(
        CONFIG.retryConfig.minTimeout * Math.pow(2, attempt),
        CONFIG.retryConfig.maxTimeout,
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

type CachePolicy = "force-cache" | "no-cache" | "only-if-cached";

class HttpClient {
  private musicBrainzLimiter = new RateLimiter();
  private fileCache = new SimpleFileCache(CONFIG.paths.httpCache);
  private stats = { cacheHits: 0, networkRequests: 0, errors: 0 };

  async fetch<T = unknown>(
    url: string,
    type: "json" | "buffer",
    policy: CachePolicy = "force-cache",
    applyRateLimit = false,
  ): Promise<T | null> {
    if (policy !== "no-cache") {
      const cached = type === "json"
        ? await this.fileCache.getJson(url)
        : await this.fileCache.getBuffer(url);
      if (cached !== null) {
        this.stats.cacheHits++;
        return cached as T;
      }
      if (policy === "only-if-cached") return null;
    }
    try {
      const response = await robustFetch(url, {
        headers: {
          "User-Agent": "ege.celikci.me/1.0",
          Accept: "application/json",
        },
      });
      if (!response.ok) return null;
      this.stats.networkRequests++;
      if (applyRateLimit) await this.musicBrainzLimiter.enforceCooldown();
      if (type === "json") {
        const data = await response.json() as T;
        this.fileCache.setJson(url, data).catch(() => {});
        return data;
      } else {
        const buffer = await response.arrayBuffer() as T;
        this.fileCache.setBuffer(url, buffer as ArrayBuffer).catch(() => {});
        return buffer;
      }
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }
  getStats() {
    return this.stats;
  }
}

// ============================================================================
// ALBUM FETCHER & PROCESSOR
// ============================================================================

class AlbumFetcher {
  constructor(private httpClient: HttpClient) {}

  async getFavoriteReviews(
    forceFullSync = false,
  ): Promise<Map<string, string>> {
    const allReviews: CritiqueBrainzReview[] = [];
    const firstUrl = this.buildReviewUrl(0);
    const firstData = await this.httpClient.fetch<CritiqueBrainzResponse>(
      firstUrl,
      "json",
      "no-cache",
    );
    if (!firstData?.reviews) return new Map();
    allReviews.push(...firstData.reviews);

    if (
      (CONFIG.syncMode === "mirror" || forceFullSync) &&
      firstData.count > CONFIG.fetchLimit
    ) {
      for (
        let offset = CONFIG.fetchLimit;
        offset < firstData.count;
        offset += CONFIG.fetchLimit
      ) {
        const data = await this.httpClient.fetch<CritiqueBrainzResponse>(
          this.buildReviewUrl(offset),
          "json",
          "force-cache",
          true,
        );
        if (data?.reviews) allReviews.push(...data.reviews);
      }
    }
    return new Map(
      allReviews
        .filter((r) => r.entity_type === "release_group" && r.rating === 5)
        .map((r) => [r.entity_id, r.created]),
    );
  }

  async fetchMetadata(
    rgid: string,
    policy: CachePolicy = "force-cache",
  ): Promise<Album | null> {
    const url =
      `${CONFIG.api.musicBrainz}${rgid}?fmt=json&inc=artist-credits+releases`;
    return await this.httpClient.fetch<Album>(
      url,
      "json",
      policy,
      policy !== "only-if-cached",
    );
  }

  async fetchCoverImage(rgid: string): Promise<ArrayBuffer | null> {
    return await this.httpClient.fetch<ArrayBuffer>(
      `${CONFIG.api.coverArt}${rgid}/front-500`,
      "buffer",
    );
  }

  private buildReviewUrl(offset: number): string {
    return `${CONFIG.api.critiqueBrainz}/review?user_id=${CONFIG.credentials.critiqueBrainzId}&limit=${CONFIG.fetchLimit}&offset=${offset}`;
  }
}

class ImageProcessor {
  async checkExists(rgid: string): Promise<boolean> {
    try {
      await Deno.stat(join(CONFIG.paths.coverColor, `${rgid}.webp`));
      return true;
    } catch {
      return false;
    }
  }
  async process(rgid: string, imageBuffer: ArrayBuffer): Promise<void> {
    const colorPath = join(CONFIG.paths.coverColor, `${rgid}.webp`);
    const monoPath = join(CONFIG.paths.coverMono, `${rgid}.png`);
    await ensureDir(CONFIG.paths.coverColor);
    await ensureDir(CONFIG.paths.coverMono);
    const uint8 = new Uint8Array(imageBuffer);
    await Promise.all([
      saveColorVersion(uint8, colorPath),
      ditherWithSharp(uint8, monoPath),
    ]);
  }
  buildPaths(rgid: string) {
    return {
      color: `/assets/images/covers/colored/${rgid}.webp`,
      mono: `/assets/images/covers/monochrome/${rgid}.png`,
    };
  }
}

async function getMusicData() {
  const httpClient = new HttpClient();
  const fetcher = new AlbumFetcher(httpClient);
  const imageProcessor = new ImageProcessor();
  const cache = createCache<{ albums: ProcessedAlbum[] }>({
    filePath: CONFIG.paths.cacheFile,
    name: "music",
    validator: objectValidator(["albums"]),
  });

  const cachedData = await cache.load({ albums: [] });
  const albumsMap = new Map(cachedData.albums.map((a) => [a.id, a]));
  const favorites = await fetcher.getFavoriteReviews(albumsMap.size === 0);
  const processed: ProcessedAlbum[] = [];

  // Carry forward or fetch new
  for (const [id, ratedAt] of favorites) {
    let album = albumsMap.get(id);
    const imagesExist = await imageProcessor.checkExists(id);

    if (!album || !imagesExist) {
      const metadata = await fetcher.fetchMetadata(id);
      if (metadata) {
        if (!imagesExist) {
          const buf = await fetcher.fetchCoverImage(id);
          if (buf) await imageProcessor.process(id, buf);
        }
        const paths = imageProcessor.buildPaths(id);
        album = {
          ...metadata,
          imagePath: paths.color,
          imagePathMono: paths.mono,
          ratedAt,
        } as ProcessedAlbum;
      }
    } else {
      album.ratedAt = ratedAt; // Ensure date is updated
    }
    if (album) processed.push(album);
  }

  // Final sort by ratedAt DESC
  processed.sort((a, b) =>
    new Date(b.ratedAt || 0).getTime() - new Date(a.ratedAt || 0).getTime()
  );

  await cache.save({ albums: processed });
  return { albums: processed };
}

await getMusicData();
