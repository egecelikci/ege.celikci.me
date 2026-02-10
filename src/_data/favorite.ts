/**
 * Favorite Music Data Fetcher
 *
 * Robust, performant music data aggregator with:
 * - "Fast Lane" caching (Parallel "only-if-cached" checks)
 * - "Slow Lane" fallback (Serial rate-limited network requests)
 * - Smart asset skipping (Checks disk before downloading images)
 * - Connection Timeouts (Prevents build hangs)
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import fetch from "npm:make-fetch-happen@15.0.3";
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
  maxConcurrentImages: 4, // CPU bound
  maxConcurrentFastLane: 20, // Disk bound
  maxConcurrentMetadata: 1, // Network bound (Strictly 1 for MusicBrainz)
  rateLimitDelayMs: 1100,
  requestTimeoutMs: 15000,
  retryConfig: { retries: 3, minTimeout: 1000, maxTimeout: 5000, },

  paths: {
    cache: join(Deno.cwd(), "_cache",),
    cacheFile: join(Deno.cwd(), "_cache", "music_store.json",),
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
    const errorMsg = error instanceof Error ? error.message : String(error,);
    console.error(
      `[music] ${this.ICONS.error} ${msg}${error ? `: ${errorMsg}` : ""}`,
    );
  }

  static network(msg: string,) {
    console.log(`[music] ${this.ICONS.network} ${msg}`,);
  }

  static progress(current: number, total: number, prefix = "Progress",) {
    const percentage = total > 0
      ? ((current / total) * 100).toFixed(0,)
      : "100";
    Deno.stdout.write(
      new TextEncoder().encode(
        `\r[music] ${prefix}: ${current}/${total} (${percentage}%)`,
      ),
    );
    if (current === total) console.log("",);
  }
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private lastRequestTime = 0;

  async enforceCooldown(): Promise<void> {
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;

    if (timeSinceLast < CONFIG.rateLimitDelayMs) {
      const waitTime = CONFIG.rateLimitDelayMs - timeSinceLast;
      await new Promise((resolve,) => setTimeout(resolve, waitTime,));
    }

    this.lastRequestTime = Date.now();
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

class HttpClient {
  private stats: FetchStats = { cacheHits: 0, networkRequests: 0, errors: 0, };
  private musicBrainzLimiter = new RateLimiter();

  async fetch<T = unknown,>(
    url: string,
    type: "json" | "buffer",
    policy: CachePolicy = "force-cache",
    applyRateLimit = false,
  ): Promise<T | null> {
    try {
      const options = {
        cachePath: CONFIG.paths.httpCache,
        cache: policy,
        retry: CONFIG.retryConfig,
        signal: AbortSignal.timeout(CONFIG.requestTimeoutMs,),
        headers: {
          "User-Agent": "ege.celikci.me/1.0 (ege@celikci.me)",
          Accept: "application/json",
        },
      };

      const response = await fetch(url, options,);

      if (!response.ok) {
        if (response.status === 404) return null;

        if (policy === "only-if-cached" && response.status === 504) {
          return null; // Cache miss
        }

        if (response.status === 503 || response.status === 429) {
          Logger.warn(`Rate limit hit. Backing off...`,);
          await new Promise((r,) => setTimeout(r, 2000,));
          throw new Error(`HTTP ${response.status}: Rate limited`,);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`,);
      }

      const fromCache = !!response.headers.get("x-local-cache",);
      if (fromCache) {
        this.stats.cacheHits++;
      } else {
        this.stats.networkRequests++;
        if (applyRateLimit) {
          await this.musicBrainzLimiter.enforceCooldown();
        }
      }

      return type === "json"
        ? ((await response.json()) as T)
        : ((await response.arrayBuffer()) as T);
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
    const coldStartLabel = forceFullSync ? " [Cold Start]" : "";
    Logger.info(`Fetching favorites (Mode: ${mode}${coldStartLabel})...`,);

    const allReviews: CritiqueBrainzReview[] = [];
    const firstUrl = this.buildReviewUrl(0,);

    // Page 1 always hits network
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
          await this.httpClient.fetch<CritiqueBrainzResponse>(
            this.buildReviewUrl(offset,),
            "json",
            "force-cache",
            true,
          ).then(data => {
            if (data?.reviews) allReviews.push(...data.reviews,);
          },);
        } catch { /* ignore */ }
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
      const url = `${CONFIG.api.coverArt}${rgid}/front-500`;
      return await this.httpClient.fetch<ArrayBuffer>(
        url,
        "buffer",
        "force-cache",
        false,
      );
    } catch {
      return null;
    }
  }

  private buildReviewUrl(offset: number,): string {
    const { critiqueBrainz, } = CONFIG.api;
    const { critiqueBrainzId, } = CONFIG.credentials;
    return `${critiqueBrainz}/review?user_id=${critiqueBrainzId}&limit=${CONFIG.fetchLimit}&offset=${offset}`;
  }
}

// ============================================================================
// IMAGE PROCESSOR
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

    try {
      await ensureDir(CONFIG.paths.coverColor,);
      await ensureDir(CONFIG.paths.coverMono,);
      const uint8Buffer = new Uint8Array(imageBuffer,);
      await Promise.all([
        saveColorVersion(uint8Buffer, colorPath,),
        ditherWithSharp(uint8Buffer, monoPath,),
      ],);
    } catch (error) {
      throw new Error(`Image processing failed: ${(error as Error).message}`,);
    }
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

    // 1. FILTER: Separate Memory Cache vs Needs Fetch
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

    if (CONFIG.syncMode === "append" && !stats.coldStart) {
      for (const [id, album,] of this.albumsMap) {
        if (
          !favoriteIds.has(id,) && await this.imageProcessor.checkExists(id,)
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

    // 2. METADATA PHASE
    const metadataResults = await this.fetchMetadataPhase(needsMetadata,);

    // 3. IMAGE PHASE
    const processedAlbums = await this.processImagesPhase(metadataResults,);

    stats.processed = processedAlbums.length;
    stats.failed = needsMetadata.length - processedAlbums.length;
    results.push(...processedAlbums,);

    if (stats.failed > 0) Logger.warn(`${stats.failed} albums failed`,);
    return { albums: results, stats, };
  }

  private async fetchMetadataPhase(ids: string[],) {
    const results: Array<
      { id: string; metadata: Album; imageBuffer: ArrayBuffer | null; }
    > = [];
    const misses: string[] = [];
    let processedCount = 0;

    // --- STEP 1: FAST LANE (Cache Only) ---
    // High concurrency checks against local HTTP cache
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
          if (imagesExist) {
            results.push({ id, metadata, imageBuffer: null, },);
          } else {
            const imageBuffer = await this.fetcher.fetchCoverImage(id,);
            results.push({ id, metadata, imageBuffer, },);
          }
        } else {
          misses.push(id,);
        }
        processedCount++;
        Logger.progress(processedCount, ids.length, "Fast Cache Check",);
      }
    },);
    await Promise.all(fastWorkers,);

    if (misses.length > 0) {
      Logger.info(
        `Cache miss for ${misses.length} items. Entering Slow Lane...`,
      );
    }

    // --- STEP 2: SLOW LANE (Network) ---
    // Serial, rate-limited fetches
    processedCount = 0;
    const slowQueue = [...misses,];
    const slowWorkers = Array(
      Math.min(CONFIG.maxConcurrentMetadata, misses.length,),
    ).fill(null,).map(async () => {
      while (slowQueue.length > 0) {
        const id = slowQueue.shift();
        if (!id) break;

        try {
          // Check if images exist on disk BEFORE downloading from network
          // This saves bandwidth if we only lost the metadata cache
          const imagesExist = await this.imageProcessor.checkExists(id,);

          let metadata: Album | null = null;
          let imageBuffer: ArrayBuffer | null = null;

          if (imagesExist) {
            // Images exist: Fetch only metadata (allows network)
            metadata = await this.fetcher.fetchMetadata(id, "force-cache",);
          } else {
            // Images missing: Fetch both
            [metadata, imageBuffer,] = await Promise.all([
              this.fetcher.fetchMetadata(id, "force-cache",),
              this.fetcher.fetchCoverImage(id,),
            ],);
          }

          if (metadata) results.push({ id, metadata, imageBuffer, },);
        } catch (e) {
          Logger.error(`Failed to fetch ${id}`, e,);
        }

        processedCount++;
        Logger.progress(processedCount, misses.length, "Metadata Sync",);
      }
    },);
    await Promise.all(slowWorkers,);

    return results;
  }

  private async processImagesPhase(
    items: Array<
      { id: string; metadata: Album; imageBuffer: ArrayBuffer | null; }
    >,
  ) {
    // Only process items that actually have a new image buffer
    const toProcess = items.filter(i => i.imageBuffer !== null);

    // Items with null buffer (skipped download) just need path reconstruction
    const completed = items.filter(i => i.imageBuffer === null).map(i => ({
      ...i.metadata,
      imagePath: this.imageProcessor.buildPaths(i.id,).color,
      imagePathMono: this.imageProcessor.buildPaths(i.id,).mono,
    } as ProcessedAlbum));

    if (toProcess.length === 0) return completed;

    Logger.info(`Processing ${toProcess.length} images...`,);
    const queue = [...toProcess,];
    let count = 0;

    const workers = Array(
      Math.min(CONFIG.maxConcurrentImages, toProcess.length,),
    ).fill(null,).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item || !item.imageBuffer) break;
        try {
          await this.imageProcessor.process(item.id, item.imageBuffer,);
          const paths = this.imageProcessor.buildPaths(item.id,);
          completed.push({
            ...item.metadata,
            imagePath: paths.color,
            imagePathMono: paths.mono,
          },);
        } catch (e) {
          Logger.error(`Img failed ${item.id}`, e,);
        }
        count++;
        Logger.progress(count, toProcess.length, "Image Gen",);
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
    const albumsMap = new Map(cachedData.albums.map((a,) => [a.id, a,]),);
    const isColdStart = albumsMap.size === 0;

    if (isColdStart) Logger.info("🧊 Cold start detected",);

    const favoriteIds = await fetcher.getFavoriteIds(isColdStart,);
    if (favoriteIds.size === 0) return { albums: [], };

    const processor = new AlbumProcessor(fetcher, imageProcessor, albumsMap,);
    const result = await processor.processAlbums(favoriteIds, isColdStart,);

    result.albums.sort((a, b,) => {
      const dateA = new Date(a["first-release-date"] || 0,).getTime();
      const dateB = new Date(b["first-release-date"] || 0,).getTime();
      return dateB - dateA;
    },);

    await cache.save({ albums: result.albums, },);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2,);
    const netStats = httpClient.getStats();
    Logger.success(
      `Done in ${elapsed}s. Loaded ${result.albums.length} albums.`,
    );
    Logger.info(
      `HTTP: ${netStats.networkRequests} network, ${netStats.cacheHits} cached`,
    );

    return { albums: result.albums, };
  } catch (error) {
    Logger.error("Fatal error", error,);
    return { albums: cache.get()?.albums || [], };
  }
}

export default await getMusicData();
