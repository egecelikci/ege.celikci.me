import Fetch from "@11ty/eleventy-fetch";
import { MusicBrainzClient, } from "@kellnerd/musicbrainz";
import fs from "node:fs/promises";
import path from "node:path";
import { ditherWithSharp, saveColorVersion, } from "../../utils/images.ts";

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

const sleep = (ms: number,) =>
  new Promise((resolve,) => setTimeout(resolve, ms,));

const CACHE_DIR = ".cache";
const DATA_DIR = path.join(CACHE_DIR, "albums", "data",);
const COVER_DIR = path.join(CACHE_DIR, "albums", "covers",);
const PUBLIC_COVER_DIR_BASE = "src/assets/images/covers";
const PUBLIC_COVER_DIR_MONO = path.join(PUBLIC_COVER_DIR_BASE, "monochrome",);
const PUBLIC_COVER_DIR_COLOR = path.join(PUBLIC_COVER_DIR_BASE, "colored",);

const CRITIQUEBRAINZ_ID = Deno.env.get("CRITIQUEBRAINZ_ID",);
const LIMIT = 50;
const USER_AGENT = "ege.celikci.me/1.0 ( ege@celikci.me )";

const client = new MusicBrainzClient();

async function fileExists(filePath: string,): Promise<boolean> {
  try {
    await fs.access(filePath,);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches all 5-star album reviews from CritiqueBrainz.
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
      const batch: ReviewBatch = await Fetch(url, {
        duration: "0s",
        type: "json",
        fetchOptions: {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        },
      },);
      if (!batch.reviews?.length) break;
      allReviews.push(...batch.reviews,);
      offset += LIMIT;
      await sleep(1000,);
    } catch (e: unknown) {
      console.error(
        `[music.ts] Failed to fetch reviews from CritiqueBrainz: ${
          (e as Error).message
        }`,
      );
      break;
    }
  }
  const favReviews = allReviews.filter(
    (r,) => r.rating === 5 && r.entity_type === "release_group",
  );
  return new Set(favReviews.map((r,) => r.entity_id),);
}

/**
 * Fetches album metadata from MusicBrainz using the client library.
 */
async function fetchAlbumData(rgid: string,) {
  try {
    const data = await client.lookup("release-group", rgid, {
      inc: ["releases", "artists",],
    },);
    const filePath = path.join(DATA_DIR, `${rgid}.json`,);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2,),);
  } catch (e: unknown) {
    console.error(
      `[music.ts] Failed to fetch album data for ${rgid}: ${
        (e as Error).message
      }`,
    );
  }
}

/**
 * Fetches album cover from Cover Art Archive.
 */
async function fetchAlbumCover(rgid: string,) {
  const url = `https://coverartarchive.org/release-group/${rgid}/front-500`;
  try {
    await Fetch(url, {
      duration: "30d",
      type: "buffer",
      directory: COVER_DIR,
      filenameFormat: () => rgid,
      fetchOptions: { headers: { "User-Agent": USER_AGENT, }, },
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
 * Main data fetching and processing function.
 */
async function getMusicData() {
  await fs.mkdir(DATA_DIR, { recursive: true, },);
  await fs.mkdir(COVER_DIR, { recursive: true, },);
  await fs.mkdir(PUBLIC_COVER_DIR_MONO, { recursive: true, },);
  await fs.mkdir(PUBLIC_COVER_DIR_COLOR, { recursive: true, },);

  const favAlbumIds = await getFavoriteAlbumIds();

  for (const rgid of favAlbumIds) {
    const jsonPath = path.join(DATA_DIR, `${rgid}.json`,);
    if (!(await fileExists(jsonPath,))) {
      console.log(`[music.ts] Fetching new album: ${rgid}`,);
      await fetchAlbumData(rgid,);
      await sleep(1000,);
    }
  }

  const albums: Album[] = [];
  const cachedFiles = await fs.readdir(DATA_DIR,);

  for (const file of cachedFiles) {
    if (!file.endsWith(".json",)) continue;
    const rgid = path.basename(file, ".json",);

    const jsonPath = path.join(DATA_DIR, `${rgid}.json`,);
    const cacheCoverPath = path.join(COVER_DIR, `${rgid}.buffer`,);
    const publicMonoPath = path.join(PUBLIC_COVER_DIR_MONO, `${rgid}.png`,);
    const publicColorPath = path.join(PUBLIC_COVER_DIR_COLOR, `${rgid}.png`,);

    if (!(await fileExists(jsonPath,))) continue;

    const publicMonoExists = await fileExists(publicMonoPath,);
    const publicColorExists = await fileExists(publicColorPath,);

    if (!publicMonoExists || !publicColorExists) {
      if (!(await fileExists(cacheCoverPath,))) {
        console.log(`[music.ts] Fetching cover for: ${rgid}`,);
        await fetchAlbumCover(rgid,);
        await sleep(1000,);
      }

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

    if (await fileExists(publicColorPath,)) {
      try {
        const content: Album = JSON.parse(
          await fs.readFile(jsonPath, "utf-8",),
        );
        albums.push(content,);
      } catch (e: unknown) {
        console.error(
          `[music.ts] Error reading JSON for ${rgid}: ${(e as Error).message}`,
        );
      }
    }
  }

  albums.sort((a, b,) => {
    const dateA = a["first-release-date"]
      ? new Date(a["first-release-date"],).getTime()
      : 0;
    const dateB = b["first-release-date"]
      ? new Date(b["first-release-date"],).getTime()
      : 0;
    return dateB - dateA;
  },);

  return { albums, };
}

export default getMusicData();
