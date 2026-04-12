/**
 * src/_data/favorite.ts
 *
 * Favorite Music Data Fetcher
 *
 * Refactored to remove make-fetch-happen in favour of:
 *  - Native Deno fetch with AbortSignal.timeout()
 *  - Exponential-backoff retry via robustFetch()
 *  - SimpleFileCache: a tiny file-based HTTP response cache that replaces
 *    make-fetch-happen's `cachePath` option, preserving the Fast Lane /
 *    Slow Lane architecture without any third-party dependency.
 *
 * Preserved behaviours:
 *  - "Fast Lane"  → reads from disk cache without hitting the network
 *  - "Slow Lane"  → serial, rate-limited network fetches for cache misses
 *  - Smart asset skipping → checks disk for images before downloading
 *  - Connection timeouts → AbortSignal.timeout(15 s) per attempt
 */

import "@std/dotenv/load";
import { ensureDir, } from "@std/fs/ensure-dir";
import { join, } from "@std/path";
import { createCache, objectValidator, } from "../../utils/cache.ts";
import { ditherWithSharp, saveColorVersion, } from "../../utils/images.ts";
import type {
  Album,
  CritiqueBrainzResponse,
  CritiqueBrainzReview,
  ProcessedAlbum,
} from "../types/index.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  syncMode: "append" as "append" | "mirror",
  fetchLimit: 50,
  maxConcurrentImages: 4, // CPU-bound
  maxConcurrentFastLane: 20, // Disk-bound
  maxConcurrentMetadata: 1, // Network-bound (MusicBrainz: strictly 1 req/s)
  rateLimitDelayMs: 1100,
  requestTimeoutMs: 15_000,
  retryConfig: { retries: 3, minTimeout: 1000, maxTimeout: 5000, },

  paths: {
    cache: join(Deno.cwd(), "_cache",),
    cacheFile: join(Deno.cwd(), "_cache", "music_store.json",),
    // Persistent HTTP-response cache used by SimpleFileCache
    // Keeps the same location as the old make-fetch-happen cachePath so
    // existing cached responses are automatically superseded on next fetch.
    httpCache: join(Deno.cwd(), "_cache", "http-cache",),
    coverColor: "src/assets/images/covers/colored",
    coverMono: "src/assets/images/covers/monochrome",
  },

  api: {
    critiqueBrainz: "https://critiquebrainz.org/ws/1",
    musicBrainz: "https://musicbrainz.org/ws/2/release-group/",
    coverArt: "https://coverartarchive.org/release-group/",
  },

  credentials: {
    critiqueBrainzId: Deno.env.get("CRITIQUEBRAINZ_ID",),
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface FetchStats {
  cacheHits: number;
  networkRequests: number;
  errors: number;
}

interface ProcessingResult {
  albums: ProcessedAlbum[];
  stats: {
    total: number;
    cached: number;
    processed: number;
    failed: number;
    coldStart: boolean;
  };
}

interface MusicCache {
  albums: ProcessedAlbum[];
}

/** Maps to make-fetch-happen's cache modes; now handled by SimpleFileCache. */
type CachePolicy = "force-cache" | "no-cache" | "only-if-cached";

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

  static info(msg: string,) {
    console.log(`[music] ${this.ICONS.info} ${msg}`,);
  }

  static success(msg: string,) {
    console.log(`[music] ${this.ICONS.success} ${msg}`,);
  }

  static warn(msg: string,) {
    console.warn(`[music] ${this.ICONS.warning} ${msg}`,);
  }

  static error(msg: string, error?: unknown,) {
    const detail = error instanceof Error ? error.message : String(error,);
    console.error(
      `[music] ${this.ICONS.error} ${msg}${error ? `: ${detail}` : ""}`,
    );
  }

  static network(msg: string,) {
    console.log(`[music] ${this.ICONS.network} ${msg}`,);
  }

  static progress(current: number, total: number, prefix = "Progress",) {
    const pct = total > 0 ? ((current / total) * 100).toFixed(0,) : "100";
    Deno.stdout.write(
      new TextEncoder().encode(
        `\r[music] ${prefix}: ${current}/${total} (${pct}%)`,
      ),
    );
    if (current === total) console.log("",);
  }
}

// ============================================================================
// RATE LIMITER (unchanged)
// ============================================================================

class RateLimiter {
  private lastRequestTime = 0;

  async enforceCooldown(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < CONFIG.rateLimitDelayMs) {
      await new Promise<void>((r,) =>
        setTimeout(r, CONFIG.rateLimitDelayMs - elapsed,)
      );
    }
    this.lastRequestTime = Date.now();
  }
}

// ============================================================================
// SIMPLE FILE CACHE — replaces make-fetch-happen's cachePath option
// ============================================================================

/**
 * A minimal, persistent file-based cache for HTTP responses.
 *
 * Each URL is hashed with SHA-256 to produce a deterministic, filesystem-safe
 * filename. JSON responses are stored as `.json` files; binary payloads (cover
 * art) as `.bin` files. This gives us the three cache policies that the rest of
 * the code depends on:
 *
 *   "only-if-cached" → read from disk, return null on miss (no network)
 *   "force-cache"    → read from disk first, fall through to network on miss
 *   "no-cache"       → skip disk read, always fetch, then write to disk
 *
 * On a cold build the cache directory is empty; subsequent builds reuse it.
 */
class SimpleFileCache {
  constructor(private readonly dir: string,) {}

  /** Derive a stable, filesystem-safe filename from a URL. */
  private async urlToKey(url: string,): Promise<string> {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(url,),
    );
    return Array.from(new Uint8Array(buf,),)
      .map((b,) => b.toString(16,).padStart(2, "0",))
      .join("",);
  }

  async getJson(url: string,): Promise<unknown | null> {
    try {
      const key = await this.urlToKey(url,);
      const text = await Deno.readTextFile(join(this.dir, `${key}.json`,),);
      return JSON.parse(text,);
    } catch {
      return null;
    }
  }

  async setJson(url: string, data: unknown,): Promise<void> {
    await ensureDir(this.dir,);
    const key = await this.urlToKey(url,);
    await Deno.writeTextFile(
      join(this.dir, `${key}.json`,),
      JSON.stringify(data,),
    );
  }

  async getBuffer(url: string,): Promise<ArrayBuffer | null> {
    try {
      const key = await this.urlToKey(url,);
      const bytes = await Deno.readFile(join(this.dir, `${key}.bin`,),);
      // Return a copy of the underlying buffer — avoids Uint8Array aliasing
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    } catch {
      return null;
    }
  }

  async setBuffer(url: string, data: ArrayBuffer,): Promise<void> {
    await ensureDir(this.dir,);
    const key = await this.urlToKey(url,);
    await Deno.writeFile(
      join(this.dir, `${key}.bin`,),
      new Uint8Array(data,),
    );
  }
}

// ============================================================================
// ROBUST FETCH — replaces make-fetch-happen's retry option
// ============================================================================

/**
 * Fetches a URL with a hard per-attempt timeout and exponential-backoff
 * retries on 5xx responses or network errors.
 *
 *  - 4xx errors are not retried (client errors are permanent)
 *  - Backoff: minTimeout × 2^attempt, capped at maxTimeout
 */
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
        signal: AbortSignal.timeout(CONFIG.requestTimeoutMs,),
      },);

      // 4xx → permanent failure, surface immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // 5xx → transient, retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`,);
    } catch (err) {
      // Network failure or AbortError (timeout) → retry
      lastError = err;
    }

    if (attempt < retries) {
      const delay = Math.min(
        CONFIG.retryConfig.minTimeout * Math.pow(2, attempt,),
        CONFIG.retryConfig.maxTimeout,
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
  private stats: FetchStats = { cacheHits: 0, networkRequests: 0, errors: 0, };
  private musicBrainzLimiter = new RateLimiter();
  private fileCache = new SimpleFileCache(CONFIG.paths.httpCache,);

  /**
   * Unified fetch method that mirrors make-fetch-happen's three cache policies.
   *
   * "only-if-cached" — disk only (Fast Lane): returns null on a miss
   * "force-cache"    — disk first, then network (normal builds)
   * "no-cache"       — always network (first page of CritiqueBrainz reviews)
   */
  async fetch<T = unknown,>(
    url: string,
    type: "json" | "buffer",
    policy: CachePolicy = "force-cache",
    applyRateLimit = false,
  ): Promise<T | null> {
    // ── Fast path: disk cache read ──────────────────────────────────────────
    if (policy === "only-if-cached") {
      const cached = type === "json"
        ? await this.fileCache.getJson(url,)
        : await this.fileCache.getBuffer(url,);

      if (cached !== null) {
        this.stats.cacheHits++;
        return cached as T;
      }
      // Cache miss — caller treats null as "not in cache"
      return null;
    }

    if (policy === "force-cache") {
      const cached = type === "json"
        ? await this.fileCache.getJson(url,)
        : await this.fileCache.getBuffer(url,);

      if (cached !== null) {
        this.stats.cacheHits++;
        return cached as T;
      }
      // Fall through to network below
    }

    // ── Slow path: network request ──────────────────────────────────────────
    try {
      const response = await robustFetch(url, {
        headers: {
          "User-Agent": "ege.celikci.me/1.0 (ege@celikci.me)",
          Accept: "application/json",
        },
      },);

      if (!response.ok) {
        if (response.status === 404) return null;

        if (response.status === 503 || response.status === 429) {
          Logger.warn("Rate limit hit. Backing off...",);
          await new Promise<void>((r,) => setTimeout(r, 2_000,));
          throw new Error(`HTTP ${response.status}: Rate limited`,);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
      }

      this.stats.networkRequests++;

      // Enforce MusicBrainz rate limit AFTER a successful network response
      // (same timing as the original make-fetch-happen version).
      if (applyRateLimit) {
        await this.musicBrainzLimiter.enforceCooldown();
      }

      // Consume the response body and persist to disk cache
      if (type === "json") {
        const data = await response.json() as T;
        // Fire-and-forget — don't block the caller on the write
        this.fileCache.setJson(url, data,).catch((e,) =>
          Logger.warn(`Cache write failed: ${e.message}`,)
        );
        return data;
      } else {
        const buffer = await response.arrayBuffer() as T;
        this.fileCache.setBuffer(url, buffer as ArrayBuffer,).catch((e,) =>
          Logger.warn(`Cache write failed: ${e.message}`,)
        );
        return buffer;
      }
    } catch (error) {
      if (policy === "only-if-cached") return null;
      this.stats.errors++;
      throw error;
    }
  }

  getStats() {
    return { ...this.stats, };
  }
}

// ============================================================================
// ALBUM FETCHER
// ============================================================================

class AlbumFetcher {
  constructor(private httpClient: HttpClient,) {}

  async getFavoriteIds(forceFullSync = false,): Promise<Set<string>> {
    const mode = CONFIG.syncMode;
    const coldLabel = forceFullSync ? " [Cold Start]" : "";
    Logger.info(`Fetching favorites (Mode: ${mode}${coldLabel})...`,);

    const allReviews: CritiqueBrainzReview[] = [];
    const firstUrl = this.buildReviewUrl(0,);

    // Page 1 always hits the network to detect new ratings
    const firstData = await this.httpClient.fetch<CritiqueBrainzResponse>(
      firstUrl,
      "json",
      "no-cache",
      false,
    );

    if (!firstData?.reviews) return new Set();

    allReviews.push(...firstData.reviews,);

    const shouldFetchAll = mode === "mirror" || forceFullSync;
    const hasMorePages = firstData.count > CONFIG.fetchLimit;

    if (shouldFetchAll && hasMorePages) {
      Logger.info(`Fetching full history (${firstData.count} reviews)...`,);
      for (
        let offset = CONFIG.fetchLimit;
        offset < firstData.count;
        offset += CONFIG.fetchLimit
      ) {
        try {
          const data = await this.httpClient.fetch<CritiqueBrainzResponse>(
            this.buildReviewUrl(offset,),
            "json",
            "force-cache",
            true,
          );
          if (data?.reviews) allReviews.push(...data.reviews,);
        } catch { /* ignore pagination errors */ }
      }
    }

    return new Set(
      allReviews
        .filter((r,) => r.entity_type === "release_group" && r.rating === 5)
        .map((r,) => r.entity_id),
    );
  }

  async fetchMetadata(
    rgid: string,
    policy: CachePolicy = "force-cache",
  ): Promise<Album | null> {
    try {
      const url =
        `${CONFIG.api.musicBrainz}${rgid}?fmt=json&inc=artist-credits+releases`;
      // Apply rate limit only when actually hitting the network
      const rateLimit = policy !== "only-if-cached";
      return await this.httpClient.fetch<Album>(
        url,
        "json",
        policy,
        rateLimit,
      );
    } catch {
      return null;
    }
  }

  async fetchCoverImage(rgid: string,): Promise<ArrayBuffer | null> {
    try {
      return await this.httpClient.fetch<ArrayBuffer>(
        `${CONFIG.api.coverArt}${rgid}/front-500`,
        "buffer",
        "force-cache",
        false,
      );
    } catch {
      return null;
    }
  }

  private buildReviewUrl(offset: number,): string {
    return (
      `${CONFIG.api.critiqueBrainz}/review`
      + `?user_id=${CONFIG.credentials.critiqueBrainzId}`
      + `&limit=${CONFIG.fetchLimit}`
      + `&offset=${offset}`
    );
  }
}

// ============================================================================
// IMAGE PROCESSOR (unchanged from original)
// ============================================================================

class ImageProcessor {
  async checkExists(rgid: string,): Promise<boolean> {
    try {
      await Promise.all([
        Deno.stat(join(CONFIG.paths.coverColor, `${rgid}.webp`,),),
        Deno.stat(join(CONFIG.paths.coverMono, `${rgid}.png`,),),
      ],);
      return true;
    } catch {
      return false;
    }
  }

  async process(rgid: string, imageBuffer: ArrayBuffer,): Promise<void> {
    const colorPath = join(CONFIG.paths.coverColor, `${rgid}.webp`,);
    const monoPath = join(CONFIG.paths.coverMono, `${rgid}.png`,);

    await ensureDir(CONFIG.paths.coverColor,);
    await ensureDir(CONFIG.paths.coverMono,);

    const uint8 = new Uint8Array(imageBuffer,);
    await Promise.all([
      saveColorVersion(uint8, colorPath,),
      ditherWithSharp(uint8, monoPath,),
    ],);
  }

  buildPaths(rgid: string,) {
    return {
      color: `/assets/images/covers/colored/${rgid}.webp`,
      mono: `/assets/images/covers/monochrome/${rgid}.png`,
    };
  }
}

// ============================================================================
// ALBUM PROCESSOR
// ============================================================================

class AlbumProcessor {
  constructor(
    private fetcher: AlbumFetcher,
    private imageProcessor: ImageProcessor,
    private albumsMap: Map<string, ProcessedAlbum>,
  ) {}

  async processAlbums(
    favoriteIds: Set<string>,
    isColdStart: boolean,
  ): Promise<ProcessingResult> {
    const results: ProcessedAlbum[] = [];
    const needsMetadata: string[] = [];
    const stats = {
      total: favoriteIds.size,
      cached: 0,
      processed: 0,
      failed: 0,
      coldStart: isColdStart,
    };

    // Separate already-known albums from those requiring a fetch
    for (const id of favoriteIds) {
      const cached = this.albumsMap.get(id,);
      const imagesExist = await this.imageProcessor.checkExists(id,);

      if (cached && imagesExist) {
        results.push(cached,);
        stats.cached++;
      } else {
        needsMetadata.push(id,);
      }
    }

    // In append mode, carry forward albums that dropped out of the favourites
    // list but whose images still exist on disk — avoids re-fetching anything
    if (CONFIG.syncMode === "append" && !isColdStart) {
      for (const [id, album,] of this.albumsMap) {
        if (
          !favoriteIds.has(id,)
          && await this.imageProcessor.checkExists(id,)
        ) {
          results.push(album,);
          stats.cached++;
        }
      }
    }

    if (needsMetadata.length === 0) {
      Logger.success("All albums up to date",);
      return { albums: results, stats, };
    }

    Logger.info(`Updating metadata for ${needsMetadata.length} albums...`,);

    const metadataResults = await this.fetchMetadataPhase(needsMetadata,);
    const processedAlbums = await this.processImagesPhase(metadataResults,);

    stats.processed = processedAlbums.length;
    stats.failed = needsMetadata.length - processedAlbums.length;
    results.push(...processedAlbums,);

    if (stats.failed > 0) Logger.warn(`${stats.failed} albums failed`,);

    return { albums: results, stats, };
  }

  private async fetchMetadataPhase(ids: string[],) {
    const results: Array<{
      id: string;
      metadata: Album;
      imageBuffer: ArrayBuffer | null;
    }> = [];
    const misses: string[] = [];
    let count = 0;

    // ── FAST LANE: disk-cache reads, high concurrency ──────────────────────
    const fastQueue = [...ids,];
    const fastWorkers = Array(
      Math.min(CONFIG.maxConcurrentFastLane, ids.length,),
    ).fill(null,).map(async () => {
      while (fastQueue.length > 0) {
        const id = fastQueue.shift();
        if (!id) break;

        const metadata = await this.fetcher.fetchMetadata(
          id,
          "only-if-cached",
        );

        if (metadata) {
          const imagesExist = await this.imageProcessor.checkExists(id,);
          const imageBuffer = imagesExist
            ? null
            : await this.fetcher.fetchCoverImage(id,);
          results.push({ id, metadata, imageBuffer, },);
        } else {
          misses.push(id,);
        }

        Logger.progress(++count, ids.length, "Fast Cache Check",);
      }
    },);
    await Promise.all(fastWorkers,);

    if (misses.length > 0) {
      Logger.info(
        `Cache miss for ${misses.length} items. Entering Slow Lane...`,
      );
    }

    // ── SLOW LANE: serial, rate-limited network fetches ────────────────────
    count = 0;
    const slowQueue = [...misses,];
    const slowWorkers = Array(
      Math.min(CONFIG.maxConcurrentMetadata, misses.length,),
    ).fill(null,).map(async () => {
      while (slowQueue.length > 0) {
        const id = slowQueue.shift();
        if (!id) break;

        try {
          const imagesExist = await this.imageProcessor.checkExists(id,);

          let metadata: Album | null;
          let imageBuffer: ArrayBuffer | null;

          if (imagesExist) {
            // Images already on disk — only fetch metadata
            metadata = await this.fetcher.fetchMetadata(id, "force-cache",);
            imageBuffer = null;
          } else {
            // Nothing on disk — fetch both in parallel
            [metadata, imageBuffer,] = await Promise.all([
              this.fetcher.fetchMetadata(id, "force-cache",),
              this.fetcher.fetchCoverImage(id,),
            ],);
          }

          if (metadata) results.push({ id, metadata, imageBuffer, },);
        } catch (e) {
          Logger.error(`Failed to fetch ${id}`, e,);
        }

        Logger.progress(++count, misses.length, "Metadata Sync",);
      }
    },);
    await Promise.all(slowWorkers,);

    return results;
  }

  private async processImagesPhase(
    items: Array<{
      id: string;
      metadata: Album;
      imageBuffer: ArrayBuffer | null;
    }>,
  ): Promise<ProcessedAlbum[]> {
    // Use a single reduce to avoid creating two intermediate arrays
    // (items that need processing vs items that are already complete)
    const toProcess: typeof items = [];
    const completed: ProcessedAlbum[] = [];

    for (const item of items) {
      if (item.imageBuffer !== null) {
        toProcess.push(item,);
      } else {
        const paths = this.imageProcessor.buildPaths(item.id,);
        completed.push({
          ...item.metadata,
          imagePath: paths.color,
          imagePathMono: paths.mono,
        } as ProcessedAlbum,);
      }
    }

    if (toProcess.length === 0) return completed;

    Logger.info(`Processing ${toProcess.length} images...`,);

    const queue = [...toProcess,];
    let count = 0;

    const workers = Array(
      Math.min(CONFIG.maxConcurrentImages, toProcess.length,),
    ).fill(null,).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item?.imageBuffer) break;

        try {
          await this.imageProcessor.process(item.id, item.imageBuffer,);
          const paths = this.imageProcessor.buildPaths(item.id,);
          completed.push({
            ...item.metadata,
            imagePath: paths.color,
            imagePathMono: paths.mono,
          } as ProcessedAlbum,);
        } catch (e) {
          Logger.error(`Image processing failed for ${item.id}`, e,);
        }

        Logger.progress(++count, toProcess.length, "Image Gen",);
      }
    },);
    await Promise.all(workers,);

    return completed;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function getMusicData() {
  const startTime = performance.now();
  Logger.info("🎵 Starting music data sync...",);

  const httpClient = new HttpClient();
  const imageProcessor = new ImageProcessor();
  const fetcher = new AlbumFetcher(httpClient,);

  const cache = createCache<MusicCache>({
    filePath: CONFIG.paths.cacheFile,
    name: "music",
    validator: objectValidator(["albums",],),
  },);

  try {
    const cachedData = await cache.load({ albums: [], },);
    // Build a Map once — O(1) lookup used throughout processAlbums
    const albumsMap = new Map(cachedData.albums.map((a,) => [a.id, a,]),);
    const isColdStart = albumsMap.size === 0;

    if (isColdStart) Logger.info("🧊 Cold start detected",);

    const favoriteIds = await fetcher.getFavoriteIds(isColdStart,);
    if (favoriteIds.size === 0) return { albums: [], };

    const processor = new AlbumProcessor(fetcher, imageProcessor, albumsMap,);
    const result = await processor.processAlbums(favoriteIds, isColdStart,);

    // Sort newest release first
    result.albums.sort(
      (a, b,) =>
        new Date(b["first-release-date"] ?? 0,).getTime()
        - new Date(a["first-release-date"] ?? 0,).getTime(),
    );

    await cache.save({ albums: result.albums, },);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
    const netStats = httpClient.getStats();
    Logger.success(
      `Done in ${elapsed}s. Loaded ${result.albums.length} albums.`,
    );
    Logger.info(
      `HTTP: ${netStats.networkRequests} network, ${netStats.cacheHits} cached, ${netStats.errors} errors`,
    );

    return { albums: result.albums, };
  } catch (error) {
    Logger.error("Fatal error", error,);
    return { albums: cache.get()?.albums ?? [], };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default await getMusicData();
