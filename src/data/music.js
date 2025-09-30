import Fetch from "@11ty/eleventy-fetch";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CACHE_DIR = ".cache";
const DATA_DIR = path.join(CACHE_DIR, "albums", "data");
const COVER_DIR = path.join(CACHE_DIR, "albums", "covers");
const PUBLIC_COVER_DIR = "src/assets/images/covers";
const USER_ID = "4d5dbf68-7a90-4166-b15a-16e92f549758";
const LIMIT = 50;

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

function magickExists() {
  return new Promise((resolve) => {
    const check = spawn("magick", ["-version"]);
    check.on("error", () => resolve(false));
    check.on("exit", (code) => resolve(code === 0));
  });
}

function convertWithMagick(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn("magick", [
      inputPath,
      "-dither",
      "FloydSteinberg",
      "-scale",
      "290x290",
      "-monochrome",
      outputPath,
    ]);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`magick exited with code ${code}`));
    });
  });
}

let offset = 0;
let critiqueData = [];

while (true) {
  const critiqueUrl = `https://critiquebrainz.org/ws/1/review?user_id=${USER_ID}&limit=${LIMIT}&offset=${offset}`;
  const batchData = await Fetch(critiqueUrl, {
    duration: "0s",
    type: "json",
    fetchOptions: {
      headers: {
        "User-Agent": "eleventy-fetch (https://ege.celikci.me)",
      },
    },
  });

  if (!batchData.reviews?.length) break;
  critiqueData.push(...batchData.reviews);
  offset += LIMIT;
  await sleep(1000);
}

const favReviews = critiqueData.filter(
  (r) => r.rating === 5 && r.entity_type === "release_group",
);
const favIds = new Set(favReviews.map((r) => r.entity_id));

const cachedFiles = (await fs.readdir(DATA_DIR)).filter((f) =>
  f.endsWith(".json"),
);
const cachedIds = new Set(cachedFiles.map((f) => path.basename(f, ".json")));

for (const id of cachedIds) {
  if (!favIds.has(id)) {
    await fs.rm(path.join(DATA_DIR, `${id}.json`), { force: true });
    await fs.rm(path.join(COVER_DIR, id), { force: true });
    await fs.rm(path.join(PUBLIC_COVER_DIR, `${id}.png`), { force: true });
  }
}

const hasMagick = await magickExists();

for (const review of favReviews) {
  const rgid = review.entity_id;
  const jsonPath = path.join(DATA_DIR, `${rgid}.json`);
  const cacheCoverPath = path.join(COVER_DIR, `${rgid}.buffer`);
  const publicCoverPath = path.join(PUBLIC_COVER_DIR, `${rgid}.png`);

  if (!(await fileExists(jsonPath))) {
    await Fetch(
      `https://musicbrainz.org/ws/2/release-group/${rgid}?inc=releases+artists&fmt=json`,
      {
        type: "json",
        directory: DATA_DIR,
        filenameFormat: () => rgid,
        fetchOptions: {
          headers: {
            "User-Agent": "eleventy-fetch (https://ege.celikci.me)",
          },
        },
      },
    );
    await sleep(1000);
  }
  if (!(await fileExists(cacheCoverPath))) {
    await Fetch(`https://coverartarchive.org/release-group/${rgid}/front-500`, {
      duration: "30d",
      type: "buffer",
      directory: COVER_DIR,
      filenameFormat: () => rgid,
      fetchOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.10 Safari/605.1.1",
        },
      },
    });
    await sleep(1000);
  }
  if (!(await fileExists(publicCoverPath))) {
    if (hasMagick) await convertWithMagick(cacheCoverPath, publicCoverPath);
    else await fs.copyFile(cacheCoverPath, publicCoverPath);
  }
}

let albums = [];

for (const file of await fs.readdir(DATA_DIR)) {
  if (!file.endsWith(".json")) continue;
  const content = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, file), "utf-8"),
  );
  albums.push(content);
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

export default { albums };
