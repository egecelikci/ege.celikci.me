import Fetch from "@11ty/eleventy-fetch";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_DIR = ".cache";
const DATA_DIR = path.join(CACHE_DIR, "albums", "data");
const COVER_DIR = path.join(CACHE_DIR, "albums", "covers");
const PUBLIC_COVER_DIR = "src/assets/images/covers";
const CRITIQUEBRAINZ_USER_ID = "4d5dbf68-7a90-4166-b15a-16e92f549758";
const LIMIT = 50;
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(COVER_DIR, { recursive: true });
await fs.mkdir(PUBLIC_COVER_DIR, { recursive: true });

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ditherWithSharp(inputPath, outputPath) {
  // Get the image data in grayscale
  const { data, info } = await sharp(inputPath)
    .resize(290, 290, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixels = new Uint8Array(data);

  // Floyd-Steinberg dithering algorithm
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = pixels[idx];
      const newPixel = oldPixel < 128 ? 0 : 255;
      pixels[idx] = newPixel;

      const error = oldPixel - newPixel;

      // Distribute error to neighboring pixels
      if (x + 1 < width) {
        pixels[idx + 1] += (error * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          pixels[idx + width - 1] += (error * 3) / 16;
        }
        pixels[idx + width] += (error * 5) / 16;
        if (x + 1 < width) {
          pixels[idx + width + 1] += (error * 1) / 16;
        }
      }
    }
  }

  // Save as PNG
  await sharp(Buffer.from(pixels), {
    raw: {
      width: width,
      height: height,
      channels: 1,
    },
  })
    .png()
    .toFile(outputPath);
}

/**
 * Fetches all 5-star album reviews from CritiqueBrainz.
 */
async function getFavoriteAlbumIds() {
  let offset = 0;
  let allReviews = [];
  while (true) {
    const url = `https://critiquebrainz.org/ws/1/review?user_id=${CRITIQUEBRAINZ_USER_ID}&limit=${LIMIT}&offset=${offset}`;
    try {
      const batch = await Fetch(url, {
        duration: "1d", // Cache critiquebrainz results for a day
        type: "json",
        fetchOptions: { headers: { "User-Agent": USER_AGENT } },
      });
      if (!batch.reviews?.length) break;
      allReviews.push(...batch.reviews);
      offset += LIMIT;
      await sleep(1000); // Respect API rate limits
    } catch (e) {
      console.error(
        `[music.js] Failed to fetch reviews from CritiqueBrainz: ${e.message}`,
      );
      // If the API fails, we can still proceed with what we have from the cache.
      break;
    }
  }
  const favReviews = allReviews.filter(
    (r) => r.rating === 5 && r.entity_type === "release_group",
  );
  return new Set(favReviews.map((r) => r.entity_id));
}

/**
 * Fetches album metadata from MusicBrainz.
 */
async function fetchAlbumData(rgid) {
  const url = `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=releases+artists&fmt=json`;
  try {
    await Fetch(url, {
      duration: "30d", // It's metadata, cache for a long time
      type: "json",
      directory: DATA_DIR,
      filenameFormat: () => rgid,
      fetchOptions: { headers: { "User-Agent": USER_AGENT } },
    });
  } catch (e) {
    console.error(
      `[music.js] Failed to fetch album data for ${rgid}: ${e.message}`,
    );
  }
}

/**
 * Fetches album cover from Cover Art Archive.
 */
async function fetchAlbumCover(rgid) {
  const url = `https://coverartarchive.org/release-group/${rgid}/front-500`;
  try {
    await Fetch(url, {
      duration: "30d", // Covers don't change, cache for a long time
      type: "buffer",
      directory: COVER_DIR,
      filenameFormat: () => rgid,
      fetchOptions: { headers: { "User-Agent": USER_AGENT } },
    });
  } catch (e) {
    console.error(
      `[music.js] Failed to fetch album cover for ${rgid}: ${e.message}`,
    );
  }
}

/**
 * Main data fetching and processing function.
 */
async function getMusicData() {
  const favAlbumIds = await getFavoriteAlbumIds();

  // Process each favorite album sequentially to respect API rate limits
  for (const rgid of favAlbumIds) {
    const jsonPath = path.join(DATA_DIR, `${rgid}.json`);
    const cacheCoverPath = path.join(COVER_DIR, `${rgid}.buffer`);
    const publicCoverPath = path.join(PUBLIC_COVER_DIR, `${rgid}.png`);

    if (!(await fileExists(jsonPath))) {
      await fetchAlbumData(rgid);
      await sleep(1000); // Wait 1s after fetching data
    }

    if (!(await fileExists(cacheCoverPath))) {
      await fetchAlbumCover(rgid);
      await sleep(1000); // Wait 1s after fetching cover
    }

    if (
      !(await fileExists(publicCoverPath)) &&
      (await fileExists(cacheCoverPath))
    ) {
      try {
        await ditherWithSharp(cacheCoverPath, publicCoverPath);
      } catch (e) {
        console.error(
          `[music.js] Failed to convert cover for ${rgid}: ${e.message}`,
        );
      }
    }
  }

  // Read all processed data and prepare it for Eleventy
  let albums = [];
  for (const file of await fs.readdir(DATA_DIR)) {
    if (!file.endsWith(".json")) continue;
    const rgid = path.basename(file, ".json");
    const publicCoverPath = path.join(PUBLIC_COVER_DIR, `${rgid}.png`);

    if (await fileExists(publicCoverPath)) {
      const content = JSON.parse(
        await fs.readFile(path.join(DATA_DIR, file), "utf-8"),
      );
      albums.push(content);
    }
  }

  // Sort albums by release date
  albums.sort((a, b) => {
    const dateA = a["first-release-date"]
      ? new Date(a["first-release-date"])
      : new Date(0);
    const dateB = b["first-release-date"]
      ? new Date(b["first-release-date"])
      : new Date(0);
    return dateB - dateA;
  });

  return { albums };
}

export default getMusicData();
