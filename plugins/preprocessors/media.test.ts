/**
 * Unit tests for build-time image dimension probing.
 */

import { assert, assertEquals } from "@std/assert";
import {
  enrichImagesWithDimensions,
  extractMediaImages,
  type PostImage,
  probeLocalImageSize,
  stripMediaRanges,
} from "./media.ts";

/** Tiny header-only images, kept out of Git LFS so the tests run on any clone. */
const FIXTURES = new URL("./fixtures", import.meta.url).pathname;

Deno.test("probeLocalImageSize reads PNG, JPEG, and GIF headers", async () => {
  assertEquals(await probeLocalImageSize("/portrait.png", FIXTURES), {
    width: 2,
    height: 3,
  });
  assertEquals(await probeLocalImageSize("/landscape.jpg", FIXTURES), {
    width: 3,
    height: 2,
  });
  assertEquals(await probeLocalImageSize("/square.gif", FIXTURES), {
    width: 5,
    height: 5,
  });
});

Deno.test("probeLocalImageSize ignores query strings and fragments", async () => {
  assertEquals(await probeLocalImageSize("/portrait.png?v=1#x", FIXTURES), {
    width: 2,
    height: 3,
  });
});

Deno.test("probeLocalImageSize returns undefined for truncated and empty files", async () => {
  assertEquals(
    await probeLocalImageSize("/truncated.png", FIXTURES),
    undefined,
  );
  assertEquals(await probeLocalImageSize("/empty.webp", FIXTURES), undefined);
});

Deno.test("probeLocalImageSize refuses remote, missing, and hostile paths", async () => {
  for (
    const src of [
      "https://example.com/photo.jpg",
      "/does-not-exist.jpg",
      "/../media.ts",
      "/fixtures//portrait.png",
      "/a\\b.png",
      "/notes/",
      "/portrait.txt",
    ]
  ) {
    assertEquals(await probeLocalImageSize(src, FIXTURES), undefined, src);
  }
});

Deno.test("enrichImagesWithDimensions fills gaps but never clobbers", async () => {
  const images: PostImage[] = [
    { src: "/portrait.png", alt: "probed" },
    { src: "/landscape.jpg", alt: "explicit", width: 4, height: 3 },
    { src: "https://example.com/remote.jpg", alt: "remote" },
  ];
  const snapshot = structuredClone(images);
  const enriched = await enrichImagesWithDimensions(images, FIXTURES);

  assertEquals([enriched[0].width, enriched[0].height], [2, 3]);
  assertEquals(
    [enriched[1].width, enriched[1].height],
    [4, 3],
    "explicit author dimensions must survive",
  );
  assertEquals(enriched[2].width, undefined, "remote image stays unknown");
  assertEquals(images, snapshot, "input is not mutated");
});

Deno.test("extractMediaImages finds standard and sized images once each", () => {
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

  assertEquals(images.length, 3, "each markup image extracted exactly once");
  assertEquals(images[0], {
    src: "/assets/images/gallery/cat.jpg",
    alt: "cat alt",
  });
  assertEquals(images[1].width, 800);
  assertEquals(images[1].height, 600);
  assertEquals(images[2].src, "https://example.com/r.png");
  assertEquals(ranges.length, 3, "one range per image");
  for (const [start, end] of ranges) {
    assert(start < end, "ranges are non-empty");
    assert(content.slice(start, end).startsWith("!["), "ranges cover markup");
  }
});

Deno.test("stripMediaRanges excises markup and leaves ranges untouched", () => {
  const content =
    "before\n\n![a](/i/a.jpg)\n\nmiddle\n\n![b](/i/b.jpg =2x3)\n\nafter";
  const { ranges } = extractMediaImages(content);
  const snapshot = ranges.map(([s, e]) => [s, e]);

  const stripped = stripMediaRanges(content, ranges);

  assert(!stripped.includes("!["), "no image markup remains");
  assert(stripped.includes("before"), "prose before survives");
  assert(stripped.includes("middle"), "prose between survives");
  assert(stripped.includes("after"), "prose after survives");
  assertEquals(ranges, snapshot, "input ranges are not mutated");
});

Deno.test("extractMediaImages attaches {spoiler: label} spoiler and extends ranges", () => {
  const content = [
    "dinner",
    "",
    "![ramen](/assets/images/gallery/ramen.jpg){spoiler: food photography}",
    "",
    "![plain](/assets/images/gallery/plain.jpg)",
  ].join("\n");
  const { images, ranges } = extractMediaImages(content);

  assertEquals(images.length, 2);
  assertEquals(images[0].spoiler, { label: "food photography" });
  assertEquals(images[1].spoiler, undefined);
  assertEquals(ranges.length, 2);

  const stripped = stripMediaRanges(content, ranges);
  assert(!stripped.includes("{spoiler:"), "spoiler suffix leaves the body");
  assert(!stripped.includes("ramen.jpg"), "warned image leaves the body");
  assert(stripped.includes("dinner"), "prose survives");
});

Deno.test("extractMediaImages combines =WxH sizes with spoilers", () => {
  const { images } = extractMediaImages(
    '![big](/assets/images/gallery/big.jpg =800x600 "t"){spoiler: spans lots}',
  );
  assertEquals(images.length, 1);
  assertEquals([images[0].width, images[0].height], [800, 600]);
  assertEquals(images[0].spoiler, { label: "spans lots" });
});

Deno.test("extractMediaImages ignores empty and detached {cw} markers", () => {
  const content = [
    "![a](/assets/images/gallery/a.jpg){spoiler:}",
    "",
    "{spoiler: stray}",
    "",
    "![b](/assets/images/gallery/b.jpg)",
    "{spoiler: detached by newline}",
  ].join("\n");
  const { images } = extractMediaImages(content);

  assertEquals(images.length, 2);
  assertEquals(images[0].spoiler, undefined, "empty marker ignored");
  assertEquals(images[1].spoiler, undefined, "detached marker ignored");
});
