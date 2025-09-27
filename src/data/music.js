import Fetch from "@11ty/eleventy-fetch";
import fs from "node:fs/promises";
import path from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_DIR = ".cache/";

const userId = "4d5dbf68-7a90-4166-b15a-16e92f549758";
const limit = 50;
let offset = 0;
let critiqueData = [];
let favReviews = [];
let albums = [];

try {
  while (true) {
    const critiqueUrl = `https://critiquebrainz.org/ws/1/review?user_id=${userId}&limit=${limit}&offset=${offset}`;

    const batchData = await Fetch(critiqueUrl, {
      type: "json",
      fetchOptions: {
        headers: {
          "User-Agent": "eleventy-fetch/5.1.0 (https://ege.celikci.me)",
        },
      },
    });

    if (!batchData.reviews || batchData.reviews.length === 0) {
      break;
    }

    critiqueData = critiqueData.concat(batchData.reviews);
    offset += limit;
    await sleep(1000);
  }

  favReviews = critiqueData.filter(
    (r) => r.rating === 5 && r.entity_type === "release_group",
  );

  for (let review of favReviews) {
    const rgid = review.entity_id;

    const mbUrl = `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=releases+artists&fmt=json`;
    const mbData = await Fetch(mbUrl, {
      duration: "7d",
      type: "json",
      directory: CACHE_DIR,
      fetchOptions: {
        headers: {
          "User-Agent": "eleventy-fetch/5.1.0 (https://ege.celikci.me)",
        },
      },
    });

    const coverUrl = `https://coverartarchive.org/release-group/${rgid}/front-500`;
    await Fetch(coverUrl, {
      duration: "30d",
      type: "buffer",
      directory: CACHE_DIR,
      fetchOptions: {
        headers: {
          "User-Agent": "eleventy-fetch/5.1.0 (https://ege.celikci.me)",
        },
      },
    });

    albums.push({
      id: rgid,
      title: mbData.title,
      firstReleaseDate: mbData["first-release-date"],
      artists: mbData["artist-credit"]
        .map((ac) => ac.name || ac.artist?.name)
        .join(", "),
      cover: `/assets/images/covers/${rgid}.png`,
    });

    await sleep(1000);
  }

  const coverDir = path.join(CACHE_DIR, "covers/");
  await fs.mkdir(coverDir, { recursive: true });

  const copyPromises = favReviews.map(async (review) => {
    const rgid = review.entity_id;
    const cachedCoverPath = path.join(CACHE_DIR + "covers", rgid);

    const destPath = path.join(coverDir, rgid);

    try {
      await fs.access(destPath);
      console.log(`[Cache] File ${rgid} already exists, skipping copy.`);
    } catch {
      await fs.copyFile(cachedCoverPath, destPath);
      console.log(`[Cache] Copied cover for ${rgid}`);
    }
  });

  await Promise.all(copyPromises);
} catch (err) {
  console.error("Error:", err);
}

export default {
  albums,
};
