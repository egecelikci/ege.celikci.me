import Fetch from "@11ty/eleventy-fetch";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_DIR = ".cache";
const DATA_DIR = path.join(CACHE_DIR, "albums", "data");
const COVER_DIR = path.join(CACHE_DIR, "albums", "covers");
const PUBLIC_COVER_DIR = "src/assets/images/covers";
const CRITIQUEBRAINZ_USER_ID = process.env.CRITIQUEBRAINZ_USER_ID;
const LIMIT = 50;
const USER_AGENT = "ege.celikci.me/1.0 ( ege@celikci.me )";

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

/**
 * Saves a resized, color DITHERED version of the cover.
 * OPTIMIZATION: High compression, low color count.
 */
async function saveColorVersion(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .resize(290, 290, { fit: "cover" })
      .png({
        palette: true,
        colors: 16,
        dither: 1.0,
        effort: 10,
        compressionLevel: 9,
      })
      .toFile(outputPath);
  } catch (e) {
    console.error(`[music.js] Failed to save color cover: ${e.message}`);
  }
}

/**
 * Process image with Floyd-Steinberg dithering (Transparent Mono)
 * OUTPUT: Transparent PNG (Black Ink + Transparent Background)
 */
async function ditherWithSharp(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .resize(290, 290, { fit: "cover" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const inputPixels = new Uint8Array(data);

  const outputPixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = inputPixels[idx];
      const newPixel = oldPixel < 128 ? 0 : 255;

      const error = oldPixel - newPixel;
      inputPixels[idx] = newPixel;

      if (x + 1 < width) inputPixels[idx + 1] += (error * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) inputPixels[idx + width - 1] += (error * 3) / 16;
        inputPixels[idx + width] += (error * 5) / 16;
        if (x + 1 < width) inputPixels[idx + width + 1] += (error * 1) / 16;
      }

      const outIdx = idx * 4;
      if (newPixel === 0) {
        outputPixels[outIdx] = 0;
        outputPixels[outIdx + 1] = 0;
        outputPixels[outIdx + 2] = 0;
        outputPixels[outIdx + 3] = 255;
      } else {
        outputPixels[outIdx] = 0;
        outputPixels[outIdx + 1] = 0;
        outputPixels[outIdx + 2] = 0;
        outputPixels[outIdx + 3] = 0;
      }
    }
  }

  await sharp(Buffer.from(outputPixels), {
    raw: {
      width: width,
      height: height,
      channels: 4,
    },
  })
    .png({
      palette: true,
      colors: 2,
      effort: 10,
    })
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
        duration: "0s",
        type: "json",
        fetchOptions: {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
        },
      });
      if (!batch.reviews?.length) break;
      allReviews.push(...batch.reviews);
      offset += LIMIT;
      await sleep(1000);
    } catch (e) {
      console.error(
        `[music.js] Failed to fetch reviews from CritiqueBrainz: ${e.message}`,
      );
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
      duration: "30d",
      type: "json",
      directory: DATA_DIR,
      filenameFormat: () => rgid,
      fetchOptions: {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      },
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
      duration: "30d",
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

  for (const rgid of favAlbumIds) {
    const jsonPath = path.join(DATA_DIR, `${rgid}.json`);
    const cacheCoverPath = path.join(COVER_DIR, `${rgid}.buffer`);
    const publicMonoPath = path.join(PUBLIC_COVER_DIR, `${rgid}.png`);
    const publicColorPath = path.join(PUBLIC_COVER_DIR, `${rgid}_color.png`);

    if (!(await fileExists(jsonPath))) {
      await fetchAlbumData(rgid);
      await sleep(1000);
    }

    if (!(await fileExists(cacheCoverPath))) {
      await fetchAlbumCover(rgid);
      await sleep(1000);
    }

    if (await fileExists(cacheCoverPath)) {
      try {
        await ditherWithSharp(cacheCoverPath, publicMonoPath);
        await saveColorVersion(cacheCoverPath, publicColorPath);
      } catch (e) {
        console.error(
          `[music.js] Failed to process images for ${rgid}: ${e.message}`,
        );
      }
    }
  }

  let albums = [];
  for (const file of await fs.readdir(DATA_DIR)) {
    if (!file.endsWith(".json")) continue;
    const rgid = path.basename(file, ".json");
    const publicMonoPath = path.join(PUBLIC_COVER_DIR, `${rgid}.png`);

    if (await fileExists(publicMonoPath)) {
      const content = JSON.parse(
        await fs.readFile(path.join(DATA_DIR, file), "utf-8"),
      );
      albums.push(content);
    }
  }

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
