/**
 * Music Data Service
 * Fetches and processes album data from CritiqueBrainz and MusicBrainz APIs
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";

import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import { DataService, } from "../src/services/DataService.ts";
import type {
  Album,
  CritiqueBrainzResponse,
  MusicDataOutput,
} from "../src/types/index.ts";
import { ditherWithSharp, saveColorVersion, } from "./images.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_DIR = "_cache";
const DATA_DIR = join(CACHE_DIR, "albums", "data",);
const COVER_DIR = join(CACHE_DIR, "albums", "covers",);
const PUBLIC_COVER_DIR_BASE = "src/assets/images/covers";
const PUBLIC_COVER_DIR_MONO = join(PUBLIC_COVER_DIR_BASE, "monochrome",);
const PUBLIC_COVER_DIR_COLOR = join(PUBLIC_COVER_DIR_BASE, "colored",);

const CRITIQUEBRAINZ_ID = Deno.env.get("CRITIQUEBRAINZ_ID",);
const CRITIQUEBRAINZ_API = "https://critiquebrainz.org/ws/1";
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const COVERART_API = "https://coverartarchive.org";

const FETCH_LIMIT = 50;
const RATE_LIMIT_DELAY = 1000;
const MAX_CONCURRENT_IMAGES = 4;

const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

// Initialize DataService
const dataService = new DataService(CACHE_DIR,);

// ============================================================================
// UTILITIES
// ============================================================================

async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number,): Promise<void> {
  return new Promise((resolve,) => setTimeout(resolve, ms,));
}

async function parallelProcess<T,>(
  items: T[],
  processor: (item: T,) => Promise<void>,
  concurrency = MAX_CONCURRENT_IMAGES,
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency,),);
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processor,),);
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetches all 5-star album reviews from CritiqueBrainz
 */
async function getFavoriteAlbumIds(): Promise<Set<string>> {
  if (!CRITIQUEBRAINZ_ID) {
    console.warn("[music.ts] CRITIQUEBRAINZ_ID not set",);
    return new Set();
  }

  console.log("[music.ts] Fetching favorite albums...",);

  const allReviews: CritiqueBrainzResponse["reviews"] = [];
  let offset = 0;

  while (true) {
    const url =
      `${CRITIQUEBRAINZ_API}/review?user_id=${CRITIQUEBRAINZ_ID}&limit=${FETCH_LIMIT}&offset=${offset}`;

    try {
      const result = await dataService.fetch<CritiqueBrainzResponse>(url, {
        duration: "0s", // Always fetch fresh reviews
        gracefulFallback: true,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json",
        },
      },);

      if (!result.data.reviews?.length) break;

      allReviews.push(...result.data.reviews,);
      offset += FETCH_LIMIT;

      await sleep(RATE_LIMIT_DELAY,);
    } catch (error) {
      console.error(`[music.ts] Review fetch failed: ${error.message}`,);
      break;
    }
  }

  const favoriteIds = allReviews
    .filter((r,) => r.rating === 5 && r.entity_type === "release_group")
    .map((r,) => r.entity_id);

  console.log(`[music.ts] Found ${favoriteIds.length} favorite albums`,);
  return new Set(favoriteIds,);
}

/**
 * Fetches album metadata from MusicBrainz
 */
async function fetchAlbumMetadata(rgid: string,): Promise<void> {
  const filePath = join(DATA_DIR, `${rgid}.json`,);

  if (await fileExists(filePath,)) {
    return;
  }

  const url =
    `${MUSICBRAINZ_API}/release-group/${rgid}?inc=releases+artists&fmt=json`;

  try {
    const result = await dataService.fetch<Album>(url, {
      duration: "30d", // Metadata is stable
      gracefulFallback: true,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
    },);

    await Deno.writeTextFile(filePath, JSON.stringify(result.data, null, 2,),);
    console.log(`[music.ts] ✓ Fetched metadata: ${rgid}`,);
  } catch (error) {
    console.error(
      `[music.ts] ✗ Metadata fetch failed for ${rgid}: ${error.message}`,
    );
  }
}

/**
 * Fetches album cover from Cover Art Archive
 */
async function fetchAlbumCover(rgid: string,): Promise<void> {
  const cachePath = join(COVER_DIR, `${rgid}.buffer`,);

  if (await fileExists(cachePath,)) {
    return;
  }

  const url = `${COVERART_API}/release-group/${rgid}/front-500`;

  try {
    const result = await dataService.fetchBuffer(url, {
      duration: "30d",
      gracefulFallback: true,
      headers: { "User-Agent": USER_AGENT, },
    },);

    await ensureDir(COVER_DIR,);
    await Deno.writeFile(cachePath, result.data,);
    console.log(`[music.ts] ✓ Downloaded cover: ${rgid}`,);
  } catch (error) {
    console.error(
      `[music.ts] ✗ Cover fetch failed for ${rgid}: ${error.message}`,
    );
  }
}

// ============================================================================
// IMAGE PROCESSING
// ============================================================================

async function processAlbumImages(rgid: string,): Promise<void> {
  const cacheCoverPath = join(COVER_DIR, `${rgid}.buffer`,);
  const publicMonoPath = join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,);
  const publicColorPath = join(PUBLIC_COVER_DIR_COLOR, `${rgid}.png`,);

  if (!(await fileExists(cacheCoverPath,))) {
    return;
  }

  try {
    if (!(await fileExists(publicMonoPath,))) {
      await ditherWithSharp(cacheCoverPath, publicMonoPath,);
      console.log(`[music.ts] ✓ Generated monochrome: ${rgid}`,);
    }

    if (!(await fileExists(publicColorPath,))) {
      await saveColorVersion(cacheCoverPath, publicColorPath,);
      console.log(`[music.ts] ✓ Generated color: ${rgid}`,);
    }
  } catch (error) {
    console.error(
      `[music.ts] ✗ Image processing failed for ${rgid}: ${error.message}`,
    );
  }
}

// ============================================================================
// ALBUM DATA ASSEMBLY
// ============================================================================

async function readAlbumData(rgid: string,): Promise<Album | null> {
  const jsonPath = join(DATA_DIR, `${rgid}.json`,);
  const publicColorPath = join(PUBLIC_COVER_DIR_COLOR, `${rgid}.png`,);

  if (!(await fileExists(jsonPath,)) || !(await fileExists(publicColorPath,))) {
    return null;
  }

  try {
    const content = await Deno.readTextFile(jsonPath,);
    return JSON.parse(content,) as Album;
  } catch (error) {
    console.error(`[music.ts] ✗ Failed to read ${rgid}: ${error.message}`,);
    return null;
  }
}

function sortAlbumsByDate(albums: Album[],): Album[] {
  return albums.sort((a, b,) => {
    const dateA = a["first-release-date"]
      ? new Date(a["first-release-date"],).getTime()
      : 0;
    const dateB = b["first-release-date"]
      ? new Date(b["first-release-date"],).getTime()
      : 0;
    return dateB - dateA;
  },);
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function updateMusicData(): Promise<void> {
  console.log("[music.ts] Starting music data update...",);

  try {
    await Promise.all([
      ensureDir(DATA_DIR,),
      ensureDir(COVER_DIR,),
      ensureDir(PUBLIC_COVER_DIR_MONO,),
      ensureDir(PUBLIC_COVER_DIR_COLOR,),
    ],);

    const favoriteIds = await getFavoriteAlbumIds();
    const albumIds = Array.from(favoriteIds,);

    if (albumIds.length === 0) {
      console.warn("[music.ts] No favorite albums found",);
      return;
    }

    console.log(`[music.ts] Processing ${albumIds.length} albums...`,);

    // -----------------------------------------------------------------------
    // 1. METADATA: Filter first, then fetch
    // -----------------------------------------------------------------------
    const missingMetadata = [];

    // Check existence in parallel (fast)
    await Promise.all(albumIds.map(async (rgid,) => {
      const exists = await fileExists(join(DATA_DIR, `${rgid}.json`,),);
      if (!exists) missingMetadata.push(rgid,);
    },),);

    if (missingMetadata.length > 0) {
      console.log(
        `[music.ts] Fetching metadata for ${missingMetadata.length} new albums...`,
      );
      for (const rgid of missingMetadata) {
        await fetchAlbumMetadata(rgid,);
        await sleep(RATE_LIMIT_DELAY,); // Only wait for actual fetches
      }
    } else {
      console.log("[music.ts] ✓ All metadata cached.",);
    }

    // -----------------------------------------------------------------------
    // 2. COVERS: Filter first, then fetch
    // -----------------------------------------------------------------------
    const missingCovers = [];

    // Check existence in parallel
    await Promise.all(albumIds.map(async (rgid,) => {
      const exists = await fileExists(join(COVER_DIR, `${rgid}.buffer`,),);
      if (!exists) missingCovers.push(rgid,);
    },),);

    if (missingCovers.length > 0) {
      console.log(
        `[music.ts] Fetching covers for ${missingCovers.length} new albums...`,
      );
      for (const rgid of missingCovers) {
        await fetchAlbumCover(rgid,);
        await sleep(RATE_LIMIT_DELAY,); // Only wait for actual fetches
      }
    } else {
      console.log("[music.ts] ✓ All raw covers cached.",);
    }

    // -----------------------------------------------------------------------
    // 3. PROCESSING: Parallel generation
    // -----------------------------------------------------------------------
    // We also want to skip processing if the OUTPUT files (color/mono) already exist
    const needingProcessing = [];

    await Promise.all(albumIds.map(async (rgid,) => {
      const monoExists = await fileExists(
        join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,),
      );
      const colorExists = await fileExists(
        join(PUBLIC_COVER_DIR_COLOR, `${rgid}.png`,),
      );
      if (!monoExists || !colorExists) needingProcessing.push(rgid,);
    },),);

    if (needingProcessing.length > 0) {
      console.log(
        `[music.ts] Processing images for ${needingProcessing.length} albums...`,
      );
      await parallelProcess(needingProcessing, processAlbumImages,);
    } else {
      console.log("[music.ts] ✓ All images processed.",);
    }

    // -----------------------------------------------------------------------
    // 4. ASSEMBLY
    // -----------------------------------------------------------------------
    const albumsRaw = await Promise.all(albumIds.map(readAlbumData,),);
    const albums = albumsRaw.filter((a,): a is Album => a !== null);
    const sortedAlbums = sortAlbumsByDate(albums,);

    await Deno.writeTextFile(
      "src/_data/favorite.json",
      JSON.stringify({ albums: sortedAlbums, }, null, 2,),
    );

    console.log(
      `[music.ts] ✓ Successfully updated ${sortedAlbums.length} albums`,
    );
  } catch (error) {
    console.error(`[music.ts] ✗ Fatal error: ${error.message}`,);
    throw error;
  }
}
