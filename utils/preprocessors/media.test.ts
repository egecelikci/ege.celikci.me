/**
 * utils/preprocessors/media.test.ts
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

const PORTRAIT_CAT =
  "/assets/images/gallery/27ab1413-7b1e-44f1-a961-5d1dcac56fc4.jpg";
const LANDSCAPE_FLOWERS =
  "/assets/images/gallery/de1bd060-0801-4f96-af72-1a8ebfd53ce1.jpg";

Deno.test("probeLocalImageSize reports portrait orientation for the cat", async () => {
  const size = await probeLocalImageSize(PORTRAIT_CAT);
  assert(size !== undefined, "expected dimensions for gallery file");
  assert(size.width > 0 && size.height > 0, "dimensions must be positive");
  assert(
    size.height > size.width,
    `expected portrait, got ${size.width}x${size.height}`,
  );
});

Deno.test("probeLocalImageSize reports landscape orientation for flowers", async () => {
  const size = await probeLocalImageSize(LANDSCAPE_FLOWERS);
  assert(size !== undefined, "expected dimensions for gallery file");
  assert(
    size.width > size.height,
    `expected landscape, got ${size.width}x${size.height}`,
  );
});

Deno.test("probeLocalImageSize refuses remote, missing, and hostile paths", async () => {
  assertEquals(
    await probeLocalImageSize("https://example.com/photo.jpg"),
    undefined,
  );
  assertEquals(
    await probeLocalImageSize("/assets/images/gallery/does-not-exist.jpg"),
    undefined,
  );
  assertEquals(
    await probeLocalImageSize("/assets/images/gallery/../../deno.json"),
    undefined,
  );
  assertEquals(
    await probeLocalImageSize("/assets/images/gallery//double-slash.jpg"),
    undefined,
  );
  assertEquals(await probeLocalImageSize("/notes/"), undefined);
});

Deno.test("enrichImagesWithDimensions fills gaps but never clobbers", async () => {
  const images: PostImage[] = [
    { src: PORTRAIT_CAT, alt: "cat" },
    { src: LANDSCAPE_FLOWERS, alt: "explicit", width: 4, height: 3 },
    { src: "https://example.com/remote.jpg", alt: "remote" },
  ];
  const enriched = await enrichImagesWithDimensions(images);

  assert(
    enriched[0].width !== undefined && enriched[0].height !== undefined,
    "local image should gain dimensions",
  );
  assertEquals(
    [enriched[1].width, enriched[1].height],
    [4, 3],
    "explicit author dimensions must survive",
  );
  assertEquals(enriched[2].width, undefined, "remote image stays unknown");
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
