import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// Local runs read secrets from `.env`; Netlify sets them in the environment, which wins.
if (existsSync(".env")) process.loadEnvFile();
import type {
  Album,
  CritiqueBrainzReview,
  MusicStore,
  ProcessedAlbum,
} from "../src/types/index.ts";
import { loadState, saveState, sortObjectKeys } from "../lib/cache.ts";
import {
  AlbumSchema,
  CritiqueBrainzResponseSchema,
  MusicStoreSchema,
  ProcessedAlbumSchema,
  validate,
  validateOrThrow,
} from "../lib/schemas.ts";
import { ditherWithSharp, saveColorVersion } from "../lib/images.ts";
import { HttpClient } from "../lib/fetch-base.ts";

const CONFIG = {
  fetchLimit: 50,
  rateLimitDelayMs: 1100,

  paths: {
    cacheFile: join(process.cwd(), "src", "_data", "music.json"),
    coverColor: "src/assets/images/covers/colored",
    coverMono: "src/assets/images/covers/monochrome",
  },

  api: {
    critiqueBrainz: "https://critiquebrainz.org/ws/1",
    musicBrainz: "https://musicbrainz.org/ws/2/release-group/",
    coverArt: "https://coverartarchive.org/release-group/",
  },

  credentials: {
    critiqueBrainzId: process.env.CRITIQUEBRAINZ_ID,
  },
} as const;

class AlbumFetcher {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  async getFavoriteReviews(): Promise<Map<string, string>> {
    const allReviews: CritiqueBrainzReview[] = [];
    const firstUrl = this.buildReviewUrl(0);
    const firstData = await this.httpClient.fetch<unknown>(firstUrl, "json");
    const validatedFirst = validateOrThrow(
      CritiqueBrainzResponseSchema,
      firstData,
    );
    allReviews.push(...validatedFirst.reviews);

    if (validatedFirst.count > CONFIG.fetchLimit) {
      const pages: Promise<unknown>[] = [];
      for (
        let offset = CONFIG.fetchLimit;
        offset < validatedFirst.count;
        offset += CONFIG.fetchLimit
      ) {
        pages.push(
          this.httpClient.fetch<unknown>(
            this.buildReviewUrl(offset),
            "json",
            true,
          ),
        );
      }
      const results = await Promise.all(pages);
      results.forEach((data) => {
        allReviews.push(
          ...validateOrThrow(CritiqueBrainzResponseSchema, data).reviews,
        );
      });
    }
    return new Map(
      allReviews
        .filter((r) => r.entity_type === "release_group" && r.rating === 5)
        .map((r) => [r.entity_id, r.created]),
    );
  }

  async fetchMetadata(rgid: string): Promise<Album | null> {
    const url = new URL(`${CONFIG.api.musicBrainz}${rgid}`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("inc", "artist-credits");
    const data = await this.httpClient.fetch<unknown>(url.toString(), "json");
    return validate(AlbumSchema, data);
  }

  async fetchCoverImage(rgid: string): Promise<ArrayBuffer | null> {
    return await this.httpClient.fetch<ArrayBuffer>(
      `${CONFIG.api.coverArt}${rgid}/front-500`,
      "buffer",
    );
  }

  private buildReviewUrl(offset: number): string {
    const url = new URL(`${CONFIG.api.critiqueBrainz}/review`);
    url.searchParams.set("user_id", CONFIG.credentials.critiqueBrainzId ?? "");
    url.searchParams.set("limit", String(CONFIG.fetchLimit));
    url.searchParams.set("offset", String(offset));
    return url.toString();
  }
}

class ImageProcessor {
  private existingCovers = new Set<string>();

  async inventory() {
    this.existingCovers.clear();
    if (!existsSync(CONFIG.paths.coverColor)) return;
    for (const entry of await readdir(CONFIG.paths.coverColor, {
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".webp")) {
        this.existingCovers.add(entry.name.replace(".webp", ""));
      }
    }
  }

  checkExists(rgid: string): boolean {
    return this.existingCovers.has(rgid);
  }

  async process(rgid: string, imageBuffer: ArrayBuffer): Promise<void> {
    const colorPath = join(CONFIG.paths.coverColor, `${rgid}.webp`);
    const monoPath = join(CONFIG.paths.coverMono, `${rgid}.png`);
    const bytes = new Uint8Array(imageBuffer);
    await Promise.all([
      saveColorVersion(bytes, colorPath),
      ditherWithSharp(bytes, monoPath),
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
    userAgent: "ege.celikci.me/1.0 ( https://ege.celikci.me )",
    rateLimitMs: CONFIG.rateLimitDelayMs,
  });

  const fetcher = new AlbumFetcher(httpClient);
  const imageProcessor = new ImageProcessor();
  await imageProcessor.inventory();

  const cachedData = await loadState<MusicStore>(
    CONFIG.paths.cacheFile,
    { schemaVersion: 2, albums: [] },
    MusicStoreSchema,
  );
  const albumsMap = new Map(cachedData.albums.map((a) => [a.id, a]));

  console.log("[music] ℹ️ Syncing favorite albums…");
  const favorites = await fetcher.getFavoriteReviews();

  if (favorites.size === 0 && cachedData.albums.length > 0) {
    console.warn("[music] ⚠️ Empty favorites response, keeping existing cache");
    return { albums: cachedData.albums };
  }

  console.log(`[music] 🔍 Processing ${favorites.size} albums…`);

  try {
    const results = await Promise.all(
      Array.from(favorites.entries()).map(async ([id, ratedAt]) => {
        let album = albumsMap.get(id);
        const imagesExist = imageProcessor.checkExists(id);

        if (!album || !imagesExist) {
          const metadata = await fetcher.fetchMetadata(id);
          if (metadata) {
            if (!imagesExist) {
              console.log(`[music] 📥 Fetching cover for: ${metadata.title}`);
              const buf = await fetcher.fetchCoverImage(id);
              // Without a cover the album would point at missing images, so leave it out; with no cover file, the next run tries again.
              const saved =
                buf &&
                (await imageProcessor.process(id, buf).then(
                  () => true,
                  (error) => {
                    console.warn(
                      `[music] ⚠️ Cover failed for ${metadata.title}: ${
                        (error as Error).message
                      }`,
                    );
                    return false;
                  },
                ));
              if (!saved) return album;
            }

            const paths = imageProcessor.buildPaths(id);
            const processedAlbum = validate(ProcessedAlbumSchema, {
              ...metadata,
              imagePath: paths.color,
              imagePathMono: paths.mono,
              ratedAt,
            });
            if (processedAlbum) album = processedAlbum;
          }
        } else {
          album.ratedAt = ratedAt;
        }
        return album;
      }),
    );

    const processed = results.filter((a): a is ProcessedAlbum => !!a);

    processed.sort((a, b) => a.id.localeCompare(b.id));

    const hasChanged =
      JSON.stringify(sortObjectKeys(processed)) !==
      JSON.stringify(sortObjectKeys(cachedData.albums));

    if (hasChanged) {
      await saveState(
        CONFIG.paths.cacheFile,
        { schemaVersion: 2, albums: processed },
        MusicStoreSchema,
      );
      console.log(`[music] ✅ Synced ${processed.length} albums.`);
    } else {
      console.log("[music] ℹ️ No changes detected, skipping save.");
    }
    return { albums: processed };
  } catch (err) {
    console.error("[music] ❌ Sync failed, keeping existing cache:", err);
    return { albums: cachedData.albums };
  }
}

await getMusicData();
