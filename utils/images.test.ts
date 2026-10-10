/**
 * Unit tests for the monochrome dithering helpers.
 *
 * The pure tests need no permissions.
 * The Sharp end-to-end test loads native code and writes temp files, so it only runs with full permissions: `deno test -A utils/images.test.ts`.
 */

import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertNotEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  ditherWithSharp,
  floydSteinberg,
  levels,
  linearLuminance,
  linearToSrgb,
  srgbToLinear,
} from "./images.ts";

/** Build a uniform luminance field. */
function field(width: number, height: number, level: number): Float32Array {
  return new Float32Array(width * height).fill(level);
}

/** Count ink pixels in a mask. */
function inkCount(mask: Uint8Array): number {
  return mask.reduce((sum, bit) => sum + bit, 0);
}

/** Deterministic pseudo-random values in `0..1` (mulberry32). */
function noise(length: number, seed: number): Float32Array {
  let state = seed >>> 0;
  return Float32Array.from({ length }, () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/** Mirror every row of a row-major buffer. */
function mirrorRows<T extends Float32Array | Uint8Array>(
  data: T,
  width: number,
): T {
  const out = data.slice() as T;
  for (let start = 0; start < data.length; start += width) {
    out.set(data.subarray(start, start + width).reverse(), start);
  }
  return out;
}

Deno.test("srgbToLinear maps the endpoints to 0 and 1", () => {
  assertEquals(srgbToLinear(0), 0);
  assertAlmostEquals(srgbToLinear(255), 1, 1e-7);
});

Deno.test("srgbToLinear switches from the linear segment to the power curve at the 0.04045 knee", () => {
  // Code 10 (0.0392) is below the knee and code 11 (0.0431) above it.
  assertAlmostEquals(srgbToLinear(10), 10 / 255 / 12.92, 1e-7);
  assertAlmostEquals(
    srgbToLinear(11),
    ((11 / 255 + 0.055) / 1.055) ** 2.4,
    1e-7,
  );
  assertAlmostEquals(0.04045 / 12.92, ((0.04045 + 0.055) / 1.055) ** 2.4, 1e-6);
});

Deno.test("srgbToLinear decodes mid grey to about 0.2158, not 0.5", () => {
  assertAlmostEquals(srgbToLinear(128), 0.2158605, 1e-6);
});

Deno.test("srgbToLinear is strictly increasing", () => {
  for (let code = 1; code < 256; code++) {
    assert(srgbToLinear(code) > srgbToLinear(code - 1), `code ${code}`);
  }
});

Deno.test("srgbToLinear rejects codes outside 0..255", () => {
  for (const code of [-1, 256, 1.5, NaN, Infinity]) {
    assertThrows(() => srgbToLinear(code), RangeError);
  }
});

Deno.test("linearToSrgb inverts srgbToLinear for every 8-bit code", () => {
  for (let code = 0; code < 256; code++) {
    assertAlmostEquals(linearToSrgb(srgbToLinear(code)), code / 255, 1e-6);
  }
});

Deno.test("linearToSrgb clamps out-of-range values and rejects non-finite ones", () => {
  assertEquals(linearToSrgb(-0.1), 0);
  assertAlmostEquals(linearToSrgb(1.0000001), 1, 1e-12);
  for (const value of [NaN, Infinity, -Infinity]) {
    assertThrows(() => linearToSrgb(value), RangeError);
  }
});

Deno.test("levels stretches the clipped range onto 0..1 when the gain is uncapped", () => {
  const out = levels(new Float32Array([0.25, 0.5, 0.75]), {
    clip: 0,
    maxGain: Infinity,
  });
  assertEquals(Array.from(out), [0, 0.5, 1]);
});

Deno.test("levels clips the requested fraction at each end of the histogram", () => {
  // 1000 values from 0.3 to 0.7 plus a lone outlier at each end; 0.5% clipping must ignore the outliers.
  const values = new Float32Array(1002);
  for (let i = 0; i < 1000; i++) values[i + 1] = 0.3 + 0.4 * i / 999;
  values[0] = 0;
  values[1001] = 1;
  const out = levels(values, { clip: 0.005, maxGain: Infinity });
  assertEquals(out[0], 0);
  assertEquals(out[1001], 1);
  // The 0.5th and 99.5th percentiles sit about 0.002 inside 0.3 and 0.7, so the gain is a little above 2.5.
  const gain = (out[800] - out[200]) / (values[800] - values[200]);
  assert(gain > 2.5 && gain < 2.6, `gain ${gain}`);
  const unclipped = levels(values, { clip: 0, maxGain: Infinity });
  assertAlmostEquals(unclipped[500], values[500], 1e-6);
});

Deno.test("levels caps the gain about the full stretch's fixed point", () => {
  // A light, low-contrast field: the full stretch of 0.6..0.9 needs gain 3.33 and fixes 0.6 / (1 − 0.3) ≈ 0.857.
  const values = new Float32Array([0.6, 0.7, 0.8, 0.9]);
  const out = levels(values, { clip: 0, maxGain: 1.5 });
  const pivot = 0.6 / 0.7;
  for (let i = 0; i < values.length; i++) {
    assertAlmostEquals(out[i], pivot + (values[i] - pivot) * 1.5, 1e-6);
  }
  assertAlmostEquals((out[3] - out[0]) / 0.3, 1.5, 1e-5);
  assert(out[0] > 0.4, `the cover stays light: ${out[0]}`);
});

Deno.test("levels leaves a field alone when the stretch needs no more than gain 1", () => {
  const values = new Float32Array([0, 0.2, 0.9, 1]);
  assertEquals(levels(values, { clip: 0 }), values);
});

Deno.test("levels returns a flat field unchanged, without NaN", () => {
  for (const level of [0, 0.3, 0.5, 1]) {
    for (const maxGain of [1.5, Infinity]) {
      const out = levels(field(8, 8, level), { maxGain });
      assert(out.every((value) => value === Math.fround(level)), `${level}`);
    }
  }
  assertEquals(levels(new Float32Array(0)).length, 0);
});

Deno.test("levels is monotonic and stays in 0..1", () => {
  const values = noise(4096, 13).map((v) => 0.2 + 0.5 * v);
  for (const maxGain of [1, 1.5, 2, Infinity]) {
    const out = levels(values, { maxGain });
    const order = Array.from(values.keys()).sort((a, b) =>
      values[a] - values[b]
    );
    for (let k = 1; k < order.length; k++) {
      assert(out[order[k]] >= out[order[k - 1]], `maxGain ${maxGain}`);
    }
    assert(out.every((value) => value >= 0 && value <= 1));
  }
});

Deno.test("levels does not mutate its input", () => {
  const values = noise(100, 17);
  const copy = values.slice();
  levels(values);
  assertEquals(values, copy);
});

Deno.test("levels rejects invalid input", () => {
  assertThrows(
    () => levels([0.5] as unknown as Float32Array),
    TypeError,
  );
  const ok = new Float32Array([0.2, 0.8]);
  for (const clip of [-0.1, 0.5, NaN]) {
    assertThrows(() => levels(ok, { clip }), RangeError);
  }
  for (const maxGain of [0.5, 0, NaN]) {
    assertThrows(() => levels(ok, { maxGain }), RangeError);
  }
  assertThrows(() => levels(new Float32Array([0, NaN])), RangeError);
});

Deno.test("linearLuminance weights linear RGB with Rec. 709 coefficients", () => {
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  const luma = linearLuminance(rgb, 3);
  assertEquals(luma.length, 4);
  assertAlmostEquals(luma[0], 0.2126, 1e-6);
  assertAlmostEquals(luma[1], 0.7152, 1e-6);
  assertAlmostEquals(luma[2], 0.0722, 1e-6);
  assertAlmostEquals(luma[3], 1, 1e-6);
});

Deno.test("linearLuminance decodes single-channel grey", () => {
  const luma = linearLuminance(new Uint8Array([0, 128, 255]), 1);
  assertEquals(Array.from(luma), [0, srgbToLinear(128), srgbToLinear(255)]);
});

Deno.test("linearLuminance rejects alpha channels and ragged buffers", () => {
  assertThrows(() => linearLuminance(new Uint8Array(4), 2), RangeError);
  assertThrows(() => linearLuminance(new Uint8Array(8), 4), RangeError);
  assertThrows(() => linearLuminance(new Uint8Array(4), 3), RangeError);
});

Deno.test("floydSteinberg does not wrap accumulated error past 255 (old [120, 250] bug)", () => {
  // The old Uint8Array buffer turned 250 + 52.5 into 46 and inked both pixels.
  const mask = floydSteinberg(new Float32Array([120 / 255, 250 / 255]), 2, 1);
  assertEquals(Array.from(mask), [1, 0]);
});

Deno.test("floydSteinberg does not wrap accumulated error below 0 (old [140, 5] bug)", () => {
  // The old Uint8Array buffer turned 5 − 50.3 into 210 and cleared both pixels.
  const mask = floydSteinberg(new Float32Array([140 / 255, 5 / 255]), 2, 1);
  assertEquals(Array.from(mask), [0, 1]);
});

Deno.test("floydSteinberg inks every pixel of a black field", () => {
  assertEquals(inkCount(floydSteinberg(field(37, 23, 0), 37, 23)), 37 * 23);
});

Deno.test("floydSteinberg leaves a white field clear", () => {
  assertEquals(inkCount(floydSteinberg(field(37, 23, 1), 37, 23)), 0);
});

Deno.test("floydSteinberg preserves tone: ink fraction of a uniform field is 1 − level", () => {
  const width = 64;
  const height = 64;
  for (const level of [0.02, 0.1, 0.25, 1 / 3, 0.5, 0.75, 0.9, 0.98]) {
    for (const serpentine of [true, false]) {
      const mask = floydSteinberg(field(width, height, level), width, height, {
        serpentine,
      });
      const expected = (1 - level) * width * height;
      assert(
        // The error dropped below the last row costs a few pixels, well under 0.5%.
        Math.abs(inkCount(mask) - expected) <= 0.005 * width * height,
        `level ${level}, serpentine ${serpentine}: ${
          inkCount(mask)
        } ink, expected ${expected}`,
      );
    }
  }
});

Deno.test("floydSteinberg coverage falls monotonically across a horizontal gradient", () => {
  const width = 256;
  const height = 64;
  const band = 16;
  const luma = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) luma[y * width + x] = x / (width - 1);
  }
  const mask = floydSteinberg(luma, width, height);

  let previous = Infinity;
  for (let start = 0; start < width; start += band) {
    let ink = 0;
    let level = 0;
    for (let y = 0; y < height; y++) {
      for (let x = start; x < start + band; x++) {
        ink += mask[y * width + x];
        level += luma[y * width + x];
      }
    }
    const coverage = ink / (band * height);
    assert(coverage < previous, `band at ${start} is not lighter`);
    assertAlmostEquals(coverage, 1 - level / (band * height), 0.03);
    previous = coverage;
  }
});

Deno.test("floydSteinberg is deterministic", () => {
  const luma = noise(50 * 40, 7);
  assertEquals(floydSteinberg(luma, 50, 40), floydSteinberg(luma, 50, 40));
});

Deno.test("floydSteinberg returns a mask of only 0 and 1", () => {
  const mask = floydSteinberg(noise(50 * 40, 11), 50, 40);
  assertEquals(mask.length, 50 * 40);
  assert(mask.every((bit) => bit === 0 || bit === 1));
});

Deno.test("floydSteinberg does not mutate its input", () => {
  const luma = noise(30 * 20, 3);
  const copy = luma.slice();
  floydSteinberg(luma, 30, 20);
  assertEquals(luma, copy);
});

Deno.test("floydSteinberg handles 1×1 images at the threshold boundary", () => {
  assertEquals(Array.from(floydSteinberg(new Float32Array([0.49]), 1, 1)), [1]);
  assertEquals(Array.from(floydSteinberg(new Float32Array([0.5]), 1, 1)), [0]);
});

Deno.test("floydSteinberg keeps tone in a single column", () => {
  const mask = floydSteinberg(field(1, 100, 0.3), 1, 100);
  assert(Math.abs(inkCount(mask) - 70) <= 1, `${inkCount(mask)} ink`);
});

Deno.test("floydSteinberg does not flush pending error into the last row", () => {
  // Renormalising there inked about 20% of the last row of a 98% white field instead of 2%.
  const size = 290;
  const mask = floydSteinberg(field(size, size, 0.98), size, size);
  const lastRow = inkCount(mask.subarray(size * (size - 1))) / size;
  assert(lastRow < 0.05, `last row coverage ${lastRow}`);
});

Deno.test("floydSteinberg honours a custom threshold", () => {
  const luma = new Float32Array([0.2, 0.2]);
  assertEquals(Array.from(floydSteinberg(luma, 2, 1, { threshold: 0.1 })), [
    0,
    1,
  ]);
});

Deno.test("floydSteinberg rejects invalid input", () => {
  const ok = new Float32Array(4);
  assertThrows(
    () => floydSteinberg(new Float64Array(4) as unknown as Float32Array, 2, 2),
    TypeError,
  );
  for (
    const [width, height] of [[0, 4], [4, 0], [-2, -2], [1.5, 2], [NaN, 4]]
  ) {
    assertThrows(() => floydSteinberg(ok, width, height), RangeError);
  }
  assertThrows(() => floydSteinberg(ok, 3, 1), RangeError);
  assertThrows(() => floydSteinberg(ok, 2, 3), RangeError);
  assertThrows(
    () => floydSteinberg(new Float32Array([0, NaN, 0, 0]), 2, 2),
    RangeError,
  );
  assertThrows(
    () => floydSteinberg(new Float32Array([0, 0, Infinity, 0]), 2, 2),
    RangeError,
  );
  assertThrows(() => floydSteinberg(ok, 2, 2, { threshold: NaN }), RangeError);
});

Deno.test("floydSteinberg serpentine scans odd rows right to left with a mirrored kernel", () => {
  // Row 0 is exact, so row 1 only sees its own error; raster and serpentine then differ only in direction, and row 1 is not the last row so its edge weights are renormalised.
  const luma = new Float32Array([1, 1, 1, 0.3, 0.3, 0.4, 1, 1, 1]);
  assertEquals(
    Array.from(floydSteinberg(luma, 3, 3, { serpentine: false })).slice(3, 6),
    [1, 1, 0],
  );
  assertEquals(Array.from(floydSteinberg(luma, 3, 3)).slice(3, 6), [1, 0, 1]);
});

Deno.test("floydSteinberg serpentine on an odd row equals raster on the mirrored row", () => {
  const width = 41;
  const row = noise(width, 5);
  const luma = new Float32Array(width * 2);
  luma.fill(1, 0, width);
  luma.set(row, width);

  const serpentine = floydSteinberg(luma, width, 2);
  const mirroredRaster = floydSteinberg(mirrorRows(luma, width), width, 2, {
    serpentine: false,
  });
  assertEquals(serpentine, mirrorRows(mirroredRaster, width));
});

Deno.test("floydSteinberg serpentine and raster scans give different patterns", () => {
  const luma = field(32, 32, 0.37);
  assertNotEquals(
    floydSteinberg(luma, 32, 32),
    floydSteinberg(luma, 32, 32, { serpentine: false }),
  );
});

const canRunSharp = (["ffi", "env", "sys", "write"] as const).every(
  (name) => Deno.permissions.querySync({ name }).state === "granted",
);

Deno.test({
  name: "ditherWithSharp end to end (run with -A)",
  ignore: !canRunSharp,
  async fn(t) {
    const sharp = (await import("sharp")).default;
    const dir = await Deno.makeTempDir();
    /** Dither an encoded image and return its decoded size, PNG metadata, and ink mask. */
    async function run(
      input: Uint8Array,
      width: number,
      tone: "gamma" | "linear" = "gamma",
    ) {
      const out = `${dir}/out-${crypto.randomUUID()}.png`;
      await ditherWithSharp(input, out, width, { tone });
      const meta = await sharp(out).metadata();
      const { data, info } = await sharp(out).ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      assertEquals([info.width, info.height, info.channels], [
        width,
        width,
        4,
      ]);
      const mask = new Uint8Array(width * width);
      for (let i = 0; i < mask.length; i++) {
        const alpha = data[i * 4 + 3];
        assert(alpha === 0 || alpha === 255, `alpha ${alpha} at ${i}`);
        if (alpha === 255) {
          assertEquals([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]], [
            0,
            0,
            0,
          ]);
          mask[i] = 1;
        }
      }
      return { meta, mask };
    }

    const grey = (channels: 3 | 4, alpha = 1) =>
      sharp({
        create: {
          width: 40,
          height: 40,
          channels,
          background: { r: 128, g: 128, b: 128, alpha },
        },
      });

    try {
      await t.step(
        "writes a 1-bit palette PNG of the requested size",
        async () => {
          const { meta } = await run(await grey(3).png().toBuffer(), 24);
          assertEquals(meta.format, "png");
          assert(meta.isPalette);
          assertEquals(meta.bitsPerSample, 1);
        },
      );

      await t.step("defaults to a 320 px square", async () => {
        const out = `${dir}/default.png`;
        await ditherWithSharp(await grey(3).png().toBuffer(), out);
        const { width, height } = await sharp(out).metadata();
        assertEquals([width, height], [320, 320]);
      });

      await t.step(
        "mid grey gets gamma-space coverage by default",
        async () => {
          const { mask } = await run(await grey(3).png().toBuffer(), 40);
          assertAlmostEquals(
            inkCount(mask) / mask.length,
            1 - 128 / 255,
            0.003,
          );
        },
      );

      await t.step(
        "mid grey gets linear-light coverage with tone: linear",
        async () => {
          const { mask } = await run(
            await grey(3).png().toBuffer(),
            40,
            "linear",
          );
          assertAlmostEquals(
            inkCount(mask) / mask.length,
            1 - srgbToLinear(128),
            0.003,
          );
        },
      );

      await t.step("rejects an unknown tone", async () => {
        await assertRejects(
          () =>
            ditherWithSharp(new Uint8Array(), `${dir}/x.png`, 8, {
              tone: "log" as "gamma",
            }),
          RangeError,
        );
      });

      await t.step("transparent pixels get no ink", async () => {
        const { mask } = await run(await grey(4, 0).png().toBuffer(), 16);
        assertEquals(inkCount(mask), 0);
      });

      await t.step(
        "16-bit, greyscale, and CMYK inputs are normalised",
        async () => {
          const singleChannel = await sharp(new Uint8Array(40 * 40).fill(128), {
            raw: { width: 40, height: 40, channels: 1 },
          }).toColourspace("b-w").png().toBuffer();
          assertEquals((await sharp(singleChannel).metadata()).channels, 1);
          const sixteenBit = await grey(3).toColourspace("rgb16").png()
            .toBuffer();
          assertEquals((await sharp(sixteenBit).metadata()).depth, "ushort");
          const cmyk = await grey(3).toColourspace("cmyk").jpeg({
            quality: 100,
          })
            .toBuffer();
          assertEquals((await sharp(cmyk).metadata()).space, "cmyk");
          const inputs = [sixteenBit, singleChannel, cmyk];
          for (const input of inputs) {
            // CMYK does not round-trip to exactly 128, so compare against Sharp's own sRGB decode of the input.
            const srgb = await sharp(input).toColourspace("srgb").raw({
              depth: "uchar",
            }).toBuffer();
            const { mask } = await run(input, 20);
            assertAlmostEquals(
              inkCount(mask) / mask.length,
              1 - linearToSrgb(linearLuminance(srgb.subarray(0, 3), 3)[0]),
              0.01,
            );
          }
        },
      );

      await t.step("EXIF orientation is applied before cropping", async () => {
        // Stored as 40×20 with the left half black; orientation 6 displays it as 20×40 with the black half on top.
        const halves = new Uint8Array(40 * 20 * 3);
        for (let y = 0; y < 20; y++) {
          for (let x = 20; x < 40; x++) {
            halves.fill(255, (y * 40 + x) * 3, (y * 40 + x) * 3 + 3);
          }
        }
        const input = await sharp(halves, {
          raw: { width: 40, height: 20, channels: 3 },
        }).withMetadata({ orientation: 6 }).png().toBuffer();
        const { mask } = await run(input, 20);
        assertEquals(inkCount(mask.subarray(0, 200)), 200);
        assertEquals(inkCount(mask.subarray(200)), 0);
      });

      await t.step("the PNG stores exactly the dithered mask", async () => {
        const input = await sharp(
          Uint8Array.from(noise(64 * 64 * 3, 9), (v) => Math.round(v * 255)),
          { raw: { width: 64, height: 64, channels: 3 } },
        ).png().toBuffer();
        const luma = levels(
          linearLuminance(
            await sharp(input).sharpen({ sigma: 0.9 }).raw().toBuffer(),
            3,
          ).map(linearToSrgb),
        );
        assertEquals((await run(input, 64)).mask, floydSteinberg(luma, 64, 64));
        const linear = luma.map((v) =>
          v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        );
        assertEquals(
          (await run(input, 64, "linear")).mask,
          floydSteinberg(linear, 64, 64),
        );
      });
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});
