/**
 * Renders the collage tool in a real browser and checks the downloaded JPEG.
 *
 * The page comes from `dist/` and every proxy request from fixtures, so nothing touches the network.
 * Each album gets its own solid colour, which makes a missing, swapped or misplaced cover visible in the pixels.
 * Golden images catch visual regressions; text rendering differs between operating systems, so refresh them with `UPDATE_GOLDEN=1` on the machine that runs the test.
 */

import { expect, type BrowserContext, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";
import {
  COLLAGE_API,
  collageApiParams,
  collageApiUrl,
} from "../lib/collage-api.ts";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MARGIN,
  calculateLayout,
  gridCoordinates,
} from "../src/assets/scripts/collage/layout.ts";

const ORIGIN = "http://collage.test";
const DIST = join(import.meta.dirname, "..", "dist");
const GOLDEN = join(import.meta.dirname, "golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const STYLES = ["aura", "silver", "velvet", "terminal", "thermal", "dark"];
const GRIDS = ["3x3", "4x4", "5x5"];

/** Titles that have broken text layout before: non-ASCII, very long, very short. */
const TITLES = [
  "TÜRKÇE RAP MİXTAPE",
  "Çok Uzun Bir Albüm Adı Ki Kırk Karakteri Rahatlıkla Aşıyor Ve Devam Ediyor",
  "a",
  "Ghost With Skin",
  "ÇOKSA VER YOKSA AL",
];

/** A saturated colour per album, spread around the hue wheel so the nearest one identifies a tile. */
function albumColour(i: number): [number, number, number] {
  const h = (i * 360) / 25 / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = [
    [1, x, 0],
    [x, 1, 0],
    [0, 1, x],
    [0, x, 1],
    [x, 0, 1],
    [1, 0, x],
  ][Math.floor(h) % 6];
  return [r * 220 + 20, g * 220 + 20, b * 220 + 20];
}

const ALBUMS = Array.from({ length: 25 }, (_, i) => {
  const mbid = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  return {
    name: TITLES[i % TITLES.length],
    artist: `Artist ${i + 1}`,
    count: 100 - i,
    mbid,
    img: collageApiUrl("cover", { mbid }),
  };
});

const covers = new Map<string, Buffer>();

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Serve `dist/` and the proxy fixtures on a fake origin; anything else is blocked. */
async function serveSite(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();

    if (url.pathname.startsWith(COLLAGE_API)) {
      const params = collageApiParams(url);
      if (params?.get("source") === "lb") {
        return route.fulfill({ json: { albums: ALBUMS } });
      }
      const cover = covers.get(params?.get("mbid") ?? "");
      return cover
        ? route.fulfill({ body: cover, contentType: "image/jpeg" })
        : route.fulfill({ status: 404, json: { error: "no fixture" } });
    }

    let file = join(DIST, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) file = join(file, "index.html");
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({
      body: await readFile(file),
      contentType: CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    });
  });
}

/** Mean RGB of a square around a point. */
function meanColour(
  pixels: Buffer,
  cx: number,
  cy: number,
  half: number,
): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(cy - half); y < cy + half; y++) {
    for (let x = Math.round(cx - half); x < cx + half; x++) {
      const i = (y * CANVAS_WIDTH + x) * 3;
      sum[0] += pixels[i];
      sum[1] += pixels[i + 1];
      sum[2] += pixels[i + 2];
      n++;
    }
  }
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

function nearestAlbum(colour: [number, number, number]): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < ALBUMS.length; i++) {
    const c = albumColour(i);
    const d =
      (c[0] - colour[0]) ** 2 +
      (c[1] - colour[1]) ** 2 +
      (c[2] - colour[2]) ** 2;
    if (d < bestDistance) [best, bestDistance] = [i, d];
  }
  return best;
}

/** Share of pixels in a box that stand out from the box's median brightness: text, not background. */
function inkShare(
  pixels: Buffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const luma: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * CANVAS_WIDTH + x) * 3;
      luma.push(
        0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2],
      );
    }
  }
  const median = [...luma].sort((a, b) => a - b)[luma.length >> 1];
  return luma.filter((l) => l > median + 50).length / luma.length;
}

test.beforeAll(async () => {
  if (!existsSync(join(DIST, "collage", "index.html"))) {
    throw new Error(
      "dist/ has no collage page; run `pnpm run test:e2e`, which builds first.",
    );
  }
  for (const [i, album] of ALBUMS.entries()) {
    const [r, g, b] = albumColour(i);
    covers.set(
      album.mbid,
      await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r, g, b },
        },
      })
        .jpeg()
        .toBuffer(),
    );
  }
  await mkdir(GOLDEN, { recursive: true });
});

for (const style of STYLES) {
  for (const grid of GRIDS) {
    test(`${style} ${grid}`, async ({ context, page }) => {
      await serveSite(context);
      const settings = {
        source: "lb",
        user: "fixture",
        period: "this_week",
        gridSize: grid,
        bgMode: style,
        textCase: "none",
        grain: true,
        glass: false,
        darkenBottom: false,
        skipMissing: true,
        showCounts: true,
        showSite: true,
        footerAuto: true,
      };
      await page.addInitScript(
        (saved) => localStorage.setItem("collage-settings-v9", saved),
        JSON.stringify(settings),
      );
      await page.goto(`${ORIGIN}/collage/`);

      const button = page.getByRole("button", {
        name: "Download collage as JPG",
      });
      await expect(button).toBeEnabled({ timeout: 30_000 });
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        button.click(),
      ]);
      const jpeg = await readFile(await download.path());

      const { data: pixels, info } = await sharp(jpeg)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([CANVAS_WIDTH, CANVAS_HEIGHT]);

      const [cols, rows] = grid.split("x").map(Number);
      const layout = calculateLayout(cols, rows);
      const tiles = gridCoordinates(cols, rows);
      const placed = Array.from({ length: cols * rows }, (_, i) =>
        nearestAlbum(
          meanColour(
            pixels,
            tiles[i * 2] + layout.itemSize / 2,
            tiles[i * 2 + 1] + layout.itemSize / 2,
            layout.itemSize / 6,
          ),
        ),
      );
      expect(
        placed,
        "each tile shows its own album's cover, in rank order",
      ).toEqual(placed.map((_, i) => i));

      const listed = Math.min(ALBUMS.length, rows > 4 ? 12 : 9);
      for (let i = 0; i < listed; i++) {
        const y = layout.listBaseY + i * layout.listRowHeight;
        expect(
          inkShare(pixels, MARGIN + 40, y - 22, MARGIN + 340, y + 4),
          `album title ${i + 1} is drawn`,
        ).toBeGreaterThan(0.005);
      }

      // The golden is stored as a small JPEG; encoding the fresh render the same way makes identical renders compare as exactly equal.
      const small = await sharp(jpeg)
        .resize(270, 480)
        .removeAlpha()
        .jpeg({ quality: 90 })
        .toBuffer();
      const golden = join(GOLDEN, `${style}-${grid}.jpg`);
      if (UPDATE) {
        await writeFile(golden, small);
        return;
      }
      expect(
        existsSync(golden),
        "no golden image; run UPDATE_GOLDEN=1 pnpm run test:e2e",
      ).toBe(true);
      const [current, reference] = await Promise.all(
        [small, await readFile(golden)].map((image) =>
          sharp(image).raw().toBuffer(),
        ),
      );
      let diff = 0;
      for (let i = 0; i < current.length; i++)
        diff += Math.abs(current[i] - reference[i]);
      expect(
        diff / current.length,
        "mean difference from the golden image, per channel",
      ).toBeLessThan(1);
    });
  }
}
