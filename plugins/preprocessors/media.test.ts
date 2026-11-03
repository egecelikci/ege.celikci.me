/**
 * Unit tests for build-time image dimension probing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enrichImagesWithDimensions,
  extractMediaImages,
  type PostImage,
  probeLocalImageSize,
  stripMediaRanges,
} from "./media.ts";

/** Tiny header-only images, kept out of Git LFS so the tests run on any clone. */
const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

test("probeLocalImageSize reads PNG, JPEG, and GIF headers", async () => {
  assert.deepEqual(await probeLocalImageSize("/portrait.png", FIXTURES), {
    width: 2,
    height: 3,
  });
  assert.deepEqual(await probeLocalImageSize("/landscape.jpg", FIXTURES), {
    width: 3,
    height: 2,
  });
  assert.deepEqual(await probeLocalImageSize("/square.gif", FIXTURES), {
    width: 5,
    height: 5,
  });
});

test("probeLocalImageSize ignores query strings and fragments", async () => {
  assert.deepEqual(await probeLocalImageSize("/portrait.png?v=1#x", FIXTURES), {
    width: 2,
    height: 3,
  });
});

test("probeLocalImageSize returns undefined for truncated and empty files", async () => {
  assert.deepEqual(
    await probeLocalImageSize("/truncated.png", FIXTURES),
    undefined,
  );
  assert.deepEqual(
    await probeLocalImageSize("/empty.webp", FIXTURES),
    undefined,
  );
});

test("probeLocalImageSize refuses remote, missing, and hostile paths", async () => {
  for (const src of [
    "https://example.com/photo.jpg",
    "/does-not-exist.jpg",
    "/../media.ts",
    "/fixtures//portrait.png",
    "/a\\b.png",
    "/notes/",
    "/portrait.txt",
  ]) {
    assert.deepEqual(await probeLocalImageSize(src, FIXTURES), undefined, src);
  }
});

test("enrichImagesWithDimensions fills gaps but never clobbers", async () => {
  const images: PostImage[] = [
    { src: "/portrait.png", alt: "probed" },
    { src: "/landscape.jpg", alt: "explicit", width: 4, height: 3 },
    { src: "https://example.com/remote.jpg", alt: "remote" },
  ];
  const snapshot = structuredClone(images);
  const enriched = await enrichImagesWithDimensions(images, FIXTURES);

  assert.deepEqual([enriched[0].width, enriched[0].height], [2, 3]);
  assert.deepEqual(
    [enriched[1].width, enriched[1].height],
    [4, 3],
    "explicit author dimensions must survive",
  );
  assert.deepEqual(enriched[2].width, undefined, "remote image stays unknown");
  assert.deepEqual(images, snapshot, "input is not mutated");
});

test("extractMediaImages finds standard and sized images once each", () => {
  const content = [
    "hello",
    "",
    "![cat alt](/assets/images/gallery/cat.jpg)",
    "",
    "middle text",
    "",
    '![sized](/assets/images/gallery/big.jpg =800x600 "title")',
    "",
    "![remote](https://example.com/r.png)",
  ].join("\n");
  const { images, ranges } = extractMediaImages(content);

  assert.deepEqual(
    images.length,
    3,
    "each markup image extracted exactly once",
  );
  assert.deepEqual(images[0], {
    src: "/assets/images/gallery/cat.jpg",
    alt: "cat alt",
  });
  assert.deepEqual(images[1].width, 800);
  assert.deepEqual(images[1].height, 600);
  assert.deepEqual(images[2].src, "https://example.com/r.png");
  assert.deepEqual(ranges.length, 3, "one range per image");
  for (const [start, end] of ranges) {
    assert.ok(start < end, "ranges are non-empty");
    assert.ok(
      content.slice(start, end).startsWith("!["),
      "ranges cover markup",
    );
  }
});

test("stripMediaRanges excises markup and leaves ranges untouched", () => {
  const content =
    "before\n\n![a](/i/a.jpg)\n\nmiddle\n\n![b](/i/b.jpg =2x3)\n\nafter";
  const { ranges } = extractMediaImages(content);
  const snapshot = ranges.map(([s, e]) => [s, e]);

  const stripped = stripMediaRanges(content, ranges);

  assert.ok(!stripped.includes("!["), "no image markup remains");
  assert.ok(stripped.includes("before"), "prose before survives");
  assert.ok(stripped.includes("middle"), "prose between survives");
  assert.ok(stripped.includes("after"), "prose after survives");
  assert.deepEqual(ranges, snapshot, "input ranges are not mutated");
});

test("extractMediaImages attaches {spoiler: label} spoiler and extends ranges", () => {
  const content = [
    "dinner",
    "",
    "![ramen](/assets/images/gallery/ramen.jpg){spoiler: food photography}",
    "",
    "![plain](/assets/images/gallery/plain.jpg)",
  ].join("\n");
  const { images, ranges } = extractMediaImages(content);

  assert.deepEqual(images.length, 2);
  assert.deepEqual(images[0].spoiler, { label: "food photography" });
  assert.deepEqual(images[1].spoiler, undefined);
  assert.deepEqual(ranges.length, 2);

  const stripped = stripMediaRanges(content, ranges);
  assert.ok(!stripped.includes("{spoiler:"), "spoiler suffix leaves the body");
  assert.ok(!stripped.includes("ramen.jpg"), "warned image leaves the body");
  assert.ok(stripped.includes("dinner"), "prose survives");
});

test("extractMediaImages combines =WxH sizes with spoilers", () => {
  const { images } = extractMediaImages(
    '![big](/assets/images/gallery/big.jpg =800x600 "t"){spoiler: spans lots}',
  );
  assert.deepEqual(images.length, 1);
  assert.deepEqual([images[0].width, images[0].height], [800, 600]);
  assert.deepEqual(images[0].spoiler, { label: "spans lots" });
});

test("extractMediaImages ignores empty and detached {cw} markers", () => {
  const content = [
    "![a](/assets/images/gallery/a.jpg){spoiler:}",
    "",
    "{spoiler: stray}",
    "",
    "![b](/assets/images/gallery/b.jpg)",
    "{spoiler: detached by newline}",
  ].join("\n");
  const { images } = extractMediaImages(content);

  assert.deepEqual(images.length, 2);
  assert.deepEqual(images[0].spoiler, undefined, "empty marker ignored");
  assert.deepEqual(images[1].spoiler, undefined, "detached marker ignored");
});
