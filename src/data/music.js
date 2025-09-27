import Fetch from "@11ty/eleventy-fetch";
import fs from "node:fs/promises";
import path from "node:path";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_DIR = ".cache/";

const userId = "4d5dbf68-7a90-4166-b15a-16e92f549758";
const limit = 50; // Number of entries to fetch per request
let offset = 0; // Starting offset
let critiqueData = [];
let favReviews = [];
let albums = []; // Ensure albums is defined here

try {
  // Fetch reviews in batches until no more reviews are available
  while (true) {
    const critiqueUrl = `https://critiquebrainz.org/ws/1/review?user_id=${userId}&limit=${limit}&offset=${offset}`;

    const batchData = await Fetch(critiqueUrl, {
      duration: "1d",
      type: "json",
      directory: CACHE_DIR,
      fetchOptions: {
        headers: {
          "User-Agent": "eleventy-fetch/5.1.0 (https://ege.celikci.me)",
        },
      },
    });

    // If no reviews are returned, break the loop
    if (batchData.reviews.length === 0) {
      break;
    }

    critiqueData = critiqueData.concat(batchData.reviews);
    offset += limit; // Increment offset for the next batch
    await sleep(1000); // Sleep for 1 second between requests
  }

  // Filter for favorite reviews
  favReviews = critiqueData.filter(
    (r) => r.rating === 5 && r.entity_type === "release_group",
  );

  await sleep(1000); // Initial sleep before processing reviews
  for (let review of favReviews) {
    const rgid = review.entity_id;
    const coverDir = path.join(CACHE_DIR, "covers/");
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

    const coverBuffer = await Fetch(coverUrl, {
      duration: "30d",
      type: "buffer",
      fetchOptions: {
        headers: {
          "User-Agent": "eleventy-fetch/5.1.0 (https://ege.celikci.me)",
        },
      },
    });

    await fs.mkdir(coverDir, { recursive: true });
    await fs.writeFile(coverDir + rgid, coverBuffer);

    albums.push({
      id: rgid,
      title: mbData.title,
      firstReleaseDate: mbData["first-release-date"],
      artists: mbData["artist-credit"]
        .map((ac) => ac.name || ac.artist?.name)
        .join(", "),
      cover: `/assets/images/covers/${rgid}.png`,
    });
    await sleep(1000); // Sleep for 1 second after each cover fetch
  }
} catch (coverErr) {}

export default {
  albums: albums,
};
