/**
 * Favorite Music Data Fetcher
 * Sorted by "Liked Date" (CritiqueBrainz review date)
 */

import "@std/dotenv/load";
import { join } from "@std/path";
import type {
  Album,
  CritiqueBrainzResponse,
  CritiqueBrainzReview,
  ProcessedAlbum,
} from "../src/types/index.ts";
import { createCache, objectValidator } from "./cache.ts";
import { ditherWithSharp, saveColorVersion } from "./images.ts";
import { HttpClient } from "./fetch-base.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  syncMode: "mirror" as "append" | "mirror",
  fetchLimit: 50,
  rateLimitDelayMs: 1100,

  paths: {
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
    policy: import("./fetch-base.ts").CachePolicy = "force-cache",
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
  const httpClient = new HttpClient({
    userAgent: "ege.celikci.me/1.0",
    rateLimitMs: CONFIG.rateLimitDelayMs,
    httpCacheDir: CONFIG.paths.httpCache,
  });

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
      album.ratedAt = ratedAt;
    }
    if (album) processed.push(album);
  }

  processed.sort((a, b) =>
    new Date(b.ratedAt || 0).getTime() - new Date(a.ratedAt || 0).getTime()
  );

  await cache.save({ albums: processed });
  return { albums: processed };
}

await getMusicData();
