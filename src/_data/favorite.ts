/**
 * Favorite Music Data
 *
 * Fixed: Page 1 now always bypasses cache to catch new reviews.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import fetch from "npm:make-fetch-happen";
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

const SYNC_MODE: "append" | "mirror" = "append";

const CACHE_DIR = join(Deno.cwd(), "_cache",);
const CACHE_FILE = join(CACHE_DIR, "music_store.json",);
const HTTP_CACHE_PATH = join(CACHE_DIR, "http-cache",);

const CRITIQUEBRAINZ_API = "https://critiquebrainz.org/ws/1";
const CRITIQUEBRAINZ_ID = Deno.env.get("CRITIQUEBRAINZ_ID",);
const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2/release-group/";
const COVERART_API = "https://coverartarchive.org/release-group/";

const FETCH_LIMIT = 50;
const MAX_CONCURRENT_IMAGES = 4;
const RATE_LIMIT_DELAY = 1100;

const PUBLIC_COVER_DIR_BASE = "src/assets/images/covers";
const PUBLIC_COVER_DIR_MONO = join(PUBLIC_COVER_DIR_BASE, "monochrome",);
const PUBLIC_COVER_DIR_COLOR = join(PUBLIC_COVER_DIR_BASE, "colored",);

// ============================================================================
// HELPERS
// ============================================================================

let lastNetworkRequest = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLast = now - lastNetworkRequest;
  if (timeSinceLast < RATE_LIMIT_DELAY) {
    await new Promise((resolve,) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLast,)
    );
  }
  lastNetworkRequest = Date.now();
}

interface FetchOptions extends RequestInit {
  cachePath?: string;
  retry?: { retries: number; minTimeout: number; maxTimeout?: number; };
  cache?: RequestCache | "force-cache" | "no-cache";
}

// UPDATE: Added `policy` parameter
async function cachedFetch(
  url: string,
  type: "json" | "buffer",
  policy: "force-cache" | "no-cache" = "force-cache",
) {
  const options: FetchOptions = {
    cachePath: HTTP_CACHE_PATH,
    cache: policy, // <--- Dynamic policy
    retry: { retries: 3, minTimeout: 1000, maxTimeout: 5000, },
    headers: {
      "User-Agent": "ege.celikci.me/1.0 (ege@celikci.me)",
      Accept: "application/json",
    },
  };

  const response = await fetch(url, options,);

  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 503 || response.status === 429) {
      console.warn(`[music] ⏳ Rate limit hit. Backing off...`,);
      await new Promise((r,) => setTimeout(r, 2000,));
      throw new Error("Rate limit",);
    }
    throw new Error(`HTTP ${response.status}`,);
  }

  if (!response.headers.get("x-local-cache",)) {
    // console.log(`[music] ⬇ Network: ${url}`);
    lastNetworkRequest = Date.now();
  }

  return type === "json" ? response.json() : response.arrayBuffer();
}

async function safeFetchMetadata(rgid: string,) {
  await waitForRateLimit();
  await fetchAlbumMetadata(rgid,);
  await fetchAlbumCover(rgid,);
}

async function checkImagesExist(rgid: string,): Promise<boolean> {
  try {
    await Promise.all([
      Deno.stat(join(PUBLIC_COVER_DIR_COLOR, `${rgid}.webp`,),),
      Deno.stat(join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,),),
    ],);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// FETCH LOGIC
// ============================================================================

async function getFavoriteAlbumIds(): Promise<Set<string>> {
  console.log(`[music] 🔍 Fetching favorites (Mode: ${SYNC_MODE})...`,);
  const allReviews: CritiqueBrainzReview[] = [];

  // 1. Always fetch Page 1 with "no-cache" to get updates
  const firstUrl =
    `${CRITIQUEBRAINZ_API}/review?user_id=${CRITIQUEBRAINZ_ID}&limit=${FETCH_LIMIT}&offset=0`;
  const firstData = (await cachedFetch(
    firstUrl,
    "json",
    "no-cache", // <--- IMPORTANT: Force network check
  )) as CritiqueBrainzResponse;

  if (firstData?.reviews) {
    allReviews.push(...firstData.reviews,);

    // 2. Decide whether to fetch older pages
    if (SYNC_MODE === "mirror" && firstData.count > FETCH_LIMIT) {
      const totalCount = firstData.count;
      console.log(`[music] 📥 Fetching deep history (${totalCount} items)...`,);

      for (
        let offset = FETCH_LIMIT;
        offset < totalCount;
        offset += FETCH_LIMIT
      ) {
        await waitForRateLimit();
        const url =
          `${CRITIQUEBRAINZ_API}/review?user_id=${CRITIQUEBRAINZ_ID}&limit=${FETCH_LIMIT}&offset=${offset}`;
        // Old pages can stay cached
        const data = (await cachedFetch(
          url,
          "json",
          "force-cache",
        )) as CritiqueBrainzResponse;
        if (data?.reviews) allReviews.push(...data.reviews,);
      }
    }
  }

  return new Set(
    allReviews
      .filter((r,) => r.entity_type === "release_group" && r.rating === 5)
      .map((r,) => r.entity_id),
  );
}

async function fetchAlbumMetadata(rgid: string,): Promise<void> {
  const url = `${MUSICBRAINZ_API}${rgid}?fmt=json&inc=artist-credits+releases`;
  await cachedFetch(url, "json", "force-cache",); // Metadata is static
}

async function fetchAlbumCover(rgid: string,): Promise<void> {
  const url = `${COVERART_API}${rgid}/front-500`;
  await cachedFetch(url, "buffer", "force-cache",); // Images are static
}

async function processAlbumImages(rgid: string,): Promise<void> {
  const finalColorPath = join(PUBLIC_COVER_DIR_COLOR, `${rgid}.webp`,);
  const finalMonoPath = join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,);

  try {
    const url = `${COVERART_API}${rgid}/front-500`;
    const buffer = (await cachedFetch(
      url,
      "buffer",
      "force-cache",
    )) as ArrayBuffer | null;
    if (!buffer) return;

    await ensureDir(PUBLIC_COVER_DIR_COLOR,);
    await ensureDir(PUBLIC_COVER_DIR_MONO,);

    const uint8Buffer = new Uint8Array(buffer,);
    await saveColorVersion(uint8Buffer, finalColorPath,);
    await ditherWithSharp(uint8Buffer, finalMonoPath,);
  } catch (error) {
    console.warn(
      `[music] ⚠ Image failed ${rgid}: ${(error as Error).message}`,
    );
  }
}

async function readAlbumData(rgid: string,): Promise<ProcessedAlbum | null> {
  try {
    const url =
      `${MUSICBRAINZ_API}${rgid}?fmt=json&inc=artist-credits+releases`;
    const data = (await cachedFetch(url, "json", "force-cache",)) as Album;
    if (!data) return null;

    return {
      ...data,
      imagePath: `/assets/images/covers/colored/${rgid}.webp`,
      imagePathMono: `/assets/images/covers/monochrome/${rgid}.png`,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function getMusicData() {
  console.log("[music] 🎵 Loading music data...",);
  const t0 = performance.now();

  // 1. Load Persistence Cache
  const cachedAlbumsMap = new Map<string, ProcessedAlbum>();
  try {
    const cachedText = await Deno.readTextFile(CACHE_FILE,);
    const cachedData = JSON.parse(cachedText,);
    if (cachedData?.albums) {
      cachedData.albums.forEach((a: ProcessedAlbum,) =>
        cachedAlbumsMap.set(a.id, a,)
      );
    }
  } catch {
    /* ignore */
  }

  // 2. Fetch IDs
  const incomingIds = await getFavoriteAlbumIds();

  // 3. Prepare Final List
  const finalAlbums: ProcessedAlbum[] = [];
  const albumsToProcess: string[] = [];
  const missingDataIds: string[] = [];

  // 4. Handle Incoming IDs (New & Updated)
  for (const id of incomingIds) {
    if (cachedAlbumsMap.has(id,) && (await checkImagesExist(id,))) {
      finalAlbums.push(cachedAlbumsMap.get(id,)!,);
    } else {
      albumsToProcess.push(id,);
      missingDataIds.push(id,);
    }
  }

  // 5. Handle "Append" Mode
  if (SYNC_MODE === "append") {
    for (const [id, album,] of cachedAlbumsMap) {
      if (!incomingIds.has(id,)) {
        if (await checkImagesExist(id,)) {
          finalAlbums.push(album,);
        }
      }
    }
  }

  // 6. Process new items
  if (albumsToProcess.length > 0) {
    console.log(`[music] ♻ Processing ${albumsToProcess.length} changes...`,);

    for (const rgid of albumsToProcess) {
      try {
        await safeFetchMetadata(rgid,);
        Deno.stdout.write(new TextEncoder().encode(".",),);
      } catch (e) {
        /* ignore */
      }
    }
    console.log("",);

    const imageWorkers = Array(
      Math.min(MAX_CONCURRENT_IMAGES, albumsToProcess.length,),
    )
      .fill(null,)
      .map(async () => {
        while (albumsToProcess.length > 0) {
          const rgid = albumsToProcess.shift();
          if (rgid) await processAlbumImages(rgid,);
        }
      },);
    await Promise.all(imageWorkers,);

    // Read Data for new items
    const newProcessed = (
      await Promise.all(missingDataIds.map(readAlbumData,),)
    ).filter((a,): a is ProcessedAlbum => a !== null);
    finalAlbums.push(...newProcessed,);
  } else {
    console.log(`[music] ⚡ No changes detected.`,);
  }

  // 7. Sort & Save
  const uniqueAlbums = Array.from(
    new Map(finalAlbums.map((a,) => [a.id, a,]),).values(),
  );

  uniqueAlbums.sort((a, b,) => {
    const dateA = new Date(a["first-release-date"] || 0,).getTime();
    const dateB = new Date(b["first-release-date"] || 0,).getTime();
    return dateB - dateA;
  },);

  const result = { albums: uniqueAlbums, };
  try {
    await ensureDir(CACHE_DIR,);
    await Deno.writeTextFile(CACHE_FILE, JSON.stringify(result, null, 2,),);
  } catch (e) {
    console.warn("Failed to save music cache:", e,);
  }

  const t1 = performance.now();
  console.log(
    `[music] ✅ Done in ${
      ((t1 - t0) / 1000).toFixed(2,)
    }s. Loaded ${uniqueAlbums.length} albums.`,
  );

  return result;
}

export default await getMusicData();
