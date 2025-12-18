import "https://deno.land/std@0.224.0/dotenv/load.ts";

import { MusicBrainzClient, } from "@kellnerd/musicbrainz";
import { ensureDir, } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { join, } from "https://deno.land/std@0.224.0/path/mod.ts";
import { cachedFetch, } from "./cache.ts";
import { ditherWithSharp, saveColorVersion, } from "./images.ts";

async function fileExists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number,) =>
  new Promise((resolve,) => setTimeout(resolve, ms,));

interface Review {
  entity_id: string;
  rating: number;
  entity_type: string;
}

interface ReviewBatch {
  reviews: Review[];
}

interface Album {
  "first-release-date"?: string;
  [key: string]: unknown;
}

const CACHE_DIR = "_cache";
const DATA_DIR = join(CACHE_DIR, "albums", "data",);
const COVER_DIR = join(CACHE_DIR, "albums", "covers",);
const PUBLIC_COVER_DIR_BASE = "src/assets/images/covers";
const PUBLIC_COVER_DIR_MONO = join(PUBLIC_COVER_DIR_BASE, "monochrome",);
const PUBLIC_COVER_DIR_COLOR = join(PUBLIC_COVER_DIR_BASE, "colored",);

const CRITIQUEBRAINZ_ID = Deno.env.get("CRITIQUEBRAINZ_ID",);
const LIMIT = 50;
const USER_AGENT = "ege.celikci.me/1.0 ( ege@celikci.me )";

const client = new MusicBrainzClient();

/**
 * Fetches all 5-star album reviews from CritiqueBrainz using cachedFetch.
 */
async function getFavoriteAlbumIds(): Promise<Set<string>> {
  if (!CRITIQUEBRAINZ_ID) {
    console.warn(
      "[music.ts] CRITIQUEBRAINZ_ID environment variable not set. Skipping favorite album fetch.",
    );
    return new Set();
  }

  let offset = 0;
  const allReviews: Review[] = [];

  while (true) {
    const url =
      `https://critiquebrainz.org/ws/1/review?user_id=${CRITIQUEBRAINZ_ID}&limit=${LIMIT}&offset=${offset}`;

    try {
      const batch = await cachedFetch(url, {
        duration: "0s",
        type: "json",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      },) as ReviewBatch;

      if (!batch.reviews?.length) break;

      allReviews.push(...batch.reviews,);
      offset += LIMIT;
      await sleep(1000,); // Respect rate limits
    } catch (e: unknown) {
      console.error(
        `[music.ts] Failed to fetch reviews from CritiqueBrainz: ${
          (e as Error).message
        }`,
      );
      break;
    }
  }

  // Filter for 5-star albums (release_group)
  const favReviews = allReviews.filter(
    (r,) => r.rating === 5 && r.entity_type === "release_group",
  );
  return new Set(favReviews.map((r,) => r.entity_id),);
}

/**
 * Fetches album metadata from MusicBrainz.
 */
async function fetchAlbumData(rgid: string,) {
  try {
    const data = await client.lookup("release-group", rgid, {
      inc: ["releases", "artists",],
    },);
    const filePath = join(DATA_DIR, `${rgid}.json`,);
    await Deno.writeTextFile(filePath, JSON.stringify(data, null, 2,),);
  } catch (e: unknown) {
    console.error(
      `[music.ts] Failed to fetch album data for ${rgid}: ${
        (e as Error).message
      }`,
    );
  }
}

/**
 * Fetches album cover from Cover Art Archive using cachedFetch.
 */
async function fetchAlbumCover(rgid: string,) {
  const url = `https://coverartarchive.org/release-group/${rgid}/front-500`;
  try {
    await cachedFetch(url, {
      duration: "30d", // Cache covers for 30 days
      type: "buffer",
      directory: COVER_DIR,
      filenameFormat: () => rgid, // Saves as COVER_DIR/rgid.buffer
      headers: { "User-Agent": USER_AGENT, },
    },);
  } catch (e: unknown) {
    console.error(
      `[music.ts] Failed to fetch album cover for ${rgid}: ${
        (e as Error).message
      }`,
    );
  }
}

/**
 * Main function: coordinates fetching, caching, and processing.
 */
export async function updateMusicData() {
  // Ensure directories exist
  await ensureDir(DATA_DIR,);
  await ensureDir(COVER_DIR,);
  await ensureDir(PUBLIC_COVER_DIR_MONO,);
  await ensureDir(PUBLIC_COVER_DIR_COLOR,);

  const favAlbumIds = await getFavoriteAlbumIds();

  // 1. Fetch Metadata
  for (const rgid of favAlbumIds) {
    const jsonPath = join(DATA_DIR, `${rgid}.json`,);
    if (!(await fileExists(jsonPath,))) {
      console.log(`[music.ts] Fetching new album: ${rgid}`,);
      await fetchAlbumData(rgid,);
      await sleep(1000,);
    }
  }

  const albums: Album[] = [];
  const cachedFiles = [];

  // Read directory
  for await (const dirEntry of Deno.readDir(DATA_DIR,)) {
    cachedFiles.push(dirEntry.name,);
  }

  // 2. Process Images & Build List
  for (const file of cachedFiles) {
    if (!file.endsWith(".json",)) continue;
    const rgid = file.replace(".json", "",);

    const jsonPath = join(DATA_DIR, `${rgid}.json`,);
    const cacheCoverPath = join(COVER_DIR, `${rgid}.buffer`,);
    const publicMonoPath = join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,);
    const publicColorPath = join(PUBLIC_COVER_DIR_COLOR, `${rgid}.png`,);

    if (!(await fileExists(jsonPath,))) continue;

    const publicMonoExists = await fileExists(publicMonoPath,);
    const publicColorExists = await fileExists(publicColorPath,);

    // Fetch cover if we don't have processed images
    if (!publicMonoExists || !publicColorExists) {
      if (!(await fileExists(cacheCoverPath,))) {
        console.log(`[music.ts] Fetching cover for: ${rgid}`,);
        await fetchAlbumCover(rgid,);
        await sleep(1000,);
      }

      // Process images if source buffer exists
      if (await fileExists(cacheCoverPath,)) {
        try {
          if (!publicMonoExists) {
            await ditherWithSharp(cacheCoverPath, publicMonoPath,);
          }
          if (!publicColorExists) {
            await saveColorVersion(cacheCoverPath, publicColorPath,);
          }
        } catch (e: unknown) {
          console.error(
            `[music.ts] Image processing failed for ${rgid}: ${
              (e as Error).message
            }`,
          );
        }
      }
    }

    // Add to albums list if we have a valid color cover
    if (await fileExists(publicColorPath,)) {
      try {
        const content: Album = JSON.parse(await Deno.readTextFile(jsonPath,),);
        albums.push(content,);
      } catch (e: unknown) {
        console.error(
          `[music.ts] Error reading JSON for ${rgid}: ${(e as Error).message}`,
        );
      }
    }
  }

  // 3. Sort by Release Date (Newest first)
  albums.sort((a, b,) => {
    const dateA = a["first-release-date"]
      ? new Date(a["first-release-date"],).getTime()
      : 0;
    const dateB = b["first-release-date"]
      ? new Date(b["first-release-date"],).getTime()
      : 0;
    return dateB - dateA;
  },);

  const outputData = { albums, };

  await Deno.writeTextFile(
    "src/_data/favorite.json",
    JSON.stringify(outputData, null, 2,),
  );
}
