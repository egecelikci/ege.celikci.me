/**
 * Cover image processing: a palette-reduced colour version and a 1-bit dithered monochrome version.
 *
 * Sharp is imported lazily so the pure helpers can be used (and tested) without native code or extra permissions.
 *
 * @module
 */

/** Options for {@link floydSteinberg}. */
export interface DitherOptions {
  /** Level below which a pixel becomes ink, in the same tone space as the input. Defaults to `0.5`. */
  threshold?: number;
  /** Alternate the scan direction on every row to avoid directional artifacts. Defaults to `true`. */
  serpentine?: boolean;
}

/** Linear-light value of every 8-bit sRGB code, per the IEC 61966-2-1 piecewise EOTF. */
const SRGB_TO_LINEAR = Float32Array.from({ length: 256 }, (_, code) => {
  const c = code / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/** Options for {@link levels}. */
export interface LevelsOptions {
  /** Fraction of pixels clipped at each end of the histogram, in `0..0.5`. Defaults to `0.005`. */
  clip?: number;
  /** Largest contrast gain applied, at least `1`; `Infinity` disables the cap. Defaults to `1.5`. */
  maxGain?: number;
}

/** Options for {@link ditherWithSharp}. */
export interface MonoOptions {
  /**
   * Tone space the error is diffused in. Defaults to `"gamma"`.
   *
   * `"gamma"` dithers sRGB-encoded luma, so ink coverage follows perceived lightness and dark covers keep visible contrast.
   * `"linear"` dithers linear light, so coverage matches physical reflectance but dark covers turn into near-solid ink.
   */
  tone?: "gamma" | "linear";
}

/** Rec. 709 / sRGB luminance weights, valid only for linear-light components. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/**
 * Convert an 8-bit sRGB code to linear light with the exact piecewise sRGB EOTF.
 *
 * @param code - Integer sRGB code in `0..255`.
 * @returns Linear-light value in `0..1`.
 * @throws {RangeError} If `code` is not an integer in `0..255`.
 * @example
 * srgbToLinear(255); // 1
 * srgbToLinear(128); // ≈ 0.2158
 */
export function srgbToLinear(code: number): number {
  if (!Number.isInteger(code) || code < 0 || code > 255) {
    throw new RangeError(`sRGB code must be an integer in 0..255, got ${code}`);
  }
  return SRGB_TO_LINEAR[code];
}

/**
 * Encode a linear-light value with the sRGB OETF, the inverse of {@link srgbToLinear}.
 *
 * @param linear - Linear-light value; anything outside `0..1` is clamped, since float sums of the luminance weights can overshoot `1` slightly.
 * @returns sRGB-encoded value in `0..1` (not an 8-bit code).
 * @throws {RangeError} If `linear` is not finite.
 * @example
 * linearToSrgb(srgbToLinear(128)); // ≈ 128 / 255
 */
export function linearToSrgb(linear: number): number {
  if (!Number.isFinite(linear)) {
    throw new RangeError(`Linear value must be finite, got ${linear}`);
  }
  const l = Math.min(1, Math.max(0, linear));
  return l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
}

/** Decode an sRGB-encoded value in `0..1` to linear light; the float counterpart of {@link srgbToLinear}. */
function srgbDecode(encoded: number): number {
  return encoded <= 0.04045
    ? encoded / 12.92
    : ((encoded + 0.055) / 1.055) ** 2.4;
}

/**
 * Stretch a `0..1` field so its clipped histogram fills `0..1`, with the contrast gain capped.
 *
 * The darkest and lightest `clip` fractions of the values are clipped, and the range between them is mapped linearly onto `0..1`.
 * When that needs more gain than `maxGain`, the mapping is scaled down to `maxGain` about its own fixed point instead, so the capped curve is continuous with the uncapped one and a uniform field keeps its tone.
 * A field with no spread is only clamped to `0..1`.
 *
 * @param values - Values per pixel, nominally `0..1`; it is not mutated.
 * @param options - Clip fraction and gain cap.
 * @returns A new field with every value in `0..1`, non-decreasing in the input.
 * @throws {TypeError} If `values` is not a `Float32Array`.
 * @throws {RangeError} If `clip` or `maxGain` is out of range or any value is not finite.
 * @example
 * levels(new Float32Array([0.25, 0.5, 0.75]), { clip: 0, maxGain: Infinity }); // Float32Array [0, 0.5, 1]
 */
export function levels(
  values: Float32Array,
  options: LevelsOptions = {},
): Float32Array {
  const { clip = 0.005, maxGain = 1.5 } = options;
  if (!(values instanceof Float32Array)) {
    throw new TypeError("Values must be a Float32Array");
  }
  if (!(clip >= 0 && clip < 0.5)) {
    throw new RangeError(`Clip must be in 0..0.5, got ${clip}`);
  }
  if (!(maxGain >= 1)) {
    throw new RangeError(`Maximum gain must be at least 1, got ${maxGain}`);
  }
  const bad = values.findIndex((value) => !Number.isFinite(value));
  if (bad !== -1) {
    throw new RangeError(`Value at index ${bad} is not finite`);
  }

  const out = Float32Array.from(values);
  if (out.length === 0) return out;
  const sorted = Float32Array.from(values).sort();
  const last = sorted.length - 1;
  const low = sorted[Math.floor(clip * last)];
  const high = sorted[Math.ceil((1 - clip) * last)];
  const span = high - low;
  if (!(span > 0)) return out.map((value) => Math.min(1, Math.max(0, value)));

  let gain = 1 / span;
  let pivot = 0;
  let offset = -low * gain;
  if (gain > maxGain) {
    // The full stretch fixes low / (1 − span); span < 1 here because maxGain ≥ 1.
    gain = maxGain;
    pivot = low / (1 - span);
    offset = pivot - pivot * gain;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.min(1, Math.max(0, values[i] * gain + offset));
  }
  return out;
}

/**
 * Compute linear-light luminance from interleaved 8-bit sRGB pixels.
 *
 * Luminance is weighted after decoding to linear light, since Rec. 709 weights are meaningless on gamma-encoded values.
 *
 * @param pixels - Interleaved 8-bit samples: grey (`channels` = 1) or RGB (`channels` = 3), without alpha.
 * @param channels - Samples per pixel, `1` or `3`.
 * @returns One linear luminance value in `0..1` per pixel.
 * @throws {RangeError} If `channels` is unsupported or `pixels` is not a whole number of pixels.
 */
export function linearLuminance(
  pixels: Uint8Array,
  channels: number,
): Float32Array {
  if (channels !== 1 && channels !== 3) {
    throw new RangeError(
      `Expected 1 (grey) or 3 (RGB) channels without alpha, got ${channels}`,
    );
  }
  if (pixels.length % channels !== 0) {
    throw new RangeError(
      `Pixel buffer length ${pixels.length} is not a multiple of ${channels} channels`,
    );
  }
  const count = pixels.length / channels;
  const luma = new Float32Array(count);
  if (channels === 1) {
    for (let i = 0; i < count; i++) luma[i] = SRGB_TO_LINEAR[pixels[i]];
    return luma;
  }
  for (let i = 0, j = 0; i < count; i++, j += 3) {
    luma[i] = LUMA_R * SRGB_TO_LINEAR[pixels[j]] +
      LUMA_G * SRGB_TO_LINEAR[pixels[j + 1]] +
      LUMA_B * SRGB_TO_LINEAR[pixels[j + 2]];
  }
  return luma;
}

/**
 * Binarise a tone field with Floyd–Steinberg error diffusion.
 *
 * The diffusion is tone-agnostic: pass linear light to preserve physical reflectance, or sRGB-encoded luma to preserve perceived lightness.
 * The input is copied into a `Float32Array` working buffer, so accumulated values may leave `0..1` without wrapping or clamping.
 * At the left and right borders the weights of the neighbours that exist are renormalised, so no error leaks out of the sides.
 * The last row keeps the textbook weights and drops the error meant for the row below.
 * With `serpentine`, odd rows run right to left with the kernel mirrored.
 *
 * @param luma - Tone per pixel in any `0..1` space, `0` black and `1` white, row-major; it is not mutated.
 * @param width - Width in pixels, a positive integer.
 * @param height - Height in pixels, a positive integer.
 * @param options - Threshold and scan order.
 * @returns A mask with one byte per pixel: `1` for ink (black), `0` for clear.
 * @throws {RangeError} If the dimensions, buffer length, threshold, or any value is invalid.
 * @throws {TypeError} If `luma` is not a `Float32Array`.
 * @example
 * floydSteinberg(new Float32Array([0, 1]), 2, 1); // Uint8Array [1, 0]
 */
export function floydSteinberg(
  luma: Float32Array,
  width: number,
  height: number,
  options: DitherOptions = {},
): Uint8Array {
  const { threshold = 0.5, serpentine = true } = options;
  if (!(luma instanceof Float32Array)) {
    throw new TypeError("Luminance must be a Float32Array");
  }
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError(`Width must be a positive integer, got ${width}`);
  }
  if (!Number.isSafeInteger(height) || height < 1) {
    throw new RangeError(`Height must be a positive integer, got ${height}`);
  }
  if (luma.length !== width * height) {
    throw new RangeError(
      `Luminance has ${luma.length} values, expected ${width}×${height} = ${
        width * height
      }`,
    );
  }
  if (!Number.isFinite(threshold)) {
    throw new RangeError(`Threshold must be finite, got ${threshold}`);
  }
  const bad = luma.findIndex((value) => !Number.isFinite(value));
  if (bad !== -1) {
    throw new RangeError(`Luminance at index ${bad} is not finite`);
  }

  const buffer = Float32Array.from(luma);
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const reverse = serpentine && y % 2 === 1;
    const step = reverse ? -1 : 1;
    const hasBelow = y + 1 < height;
    for (let i = 0; i < width; i++) {
      const x = reverse ? width - 1 - i : i;
      const index = y * width + x;
      const value = buffer[index];
      const ink = value < threshold;
      mask[index] = ink ? 1 : 0;

      const error = value - (ink ? 0 : 1);
      if (error === 0) continue;

      const hasAhead = x + step >= 0 && x + step < width;
      const hasBehind = x - step >= 0 && x - step < width;
      const ahead = hasAhead ? 7 : 0;
      const belowBehind = hasBelow && hasBehind ? 3 : 0;
      const below = hasBelow ? 5 : 0;
      const belowAhead = hasBelow && hasAhead ? 1 : 0;
      // Renormalising on the last row would flush all pending error into it and draw a dotted line along the bottom edge.
      const total = hasBelow ? ahead + belowBehind + below + belowAhead : 16;

      const share = error / total;
      if (ahead) buffer[index + step] += share * ahead;
      if (belowBehind) buffer[index + width - step] += share * belowBehind;
      if (below) buffer[index + width] += share * below;
      if (belowAhead) buffer[index + width + step] += share * belowAhead;
    }
  }
  return mask;
}

/**
 * Save a resized, colour-dithered version of a cover image.
 *
 * Downscales to a square, reduces to a 16-colour palette with libimagequant's Floyd–Steinberg dithering, then encodes as lossless WebP.
 * Failures are logged and swallowed so cover fetching never breaks the build.
 *
 * @param input - Filesystem path or in-memory bytes of the source image.
 * @param outputPath - Filesystem path for the resulting `.webp` file.
 * @param width - Square edge length in pixels. Defaults to `290`.
 * @returns A promise resolving once the file is written or an error is logged.
 */
export async function saveColorVersion(
  input: string | Uint8Array,
  outputPath: string,
  width = 290,
) {
  try {
    const sharp = (await import("sharp")).default;
    // Auto-orient like ditherWithSharp, or the hover reveal would show a differently rotated cover.
    const ditheredBuffer = await sharp(input)
      .autoOrient()
      .resize(width, width, { fit: "cover" })
      .png({
        palette: true,
        colors: 16,
        dither: 1.0,
      })
      .toBuffer();

    await sharp(ditheredBuffer)
      .webp({
        lossless: true,
        effort: 6,
        quality: 100,
      })
      .toFile(outputPath);
  } catch (e: unknown) {
    console.error(
      `[utils/images.ts] Failed to save color cover: ${(e as Error).message}`,
    );
  }
}

/**
 * Dither an image to transparent monochrome: opaque black ink, fully transparent elsewhere.
 *
 * The source is auto-oriented from EXIF, flattened onto white (so transparency means no ink), cropped and scaled to a `width`×`width` square, converted to 8-bit sRGB whatever its depth or colour space, and lightly sharpened.
 * Luma is linear-light luminance re-encoded to sRGB, then contrast-stretched by {@link levels} with its defaults.
 * By default that sRGB-encoded luma is diffused directly; `tone: "linear"` decodes it to linear light first.
 * The result is a 1-bit, 2-entry palette PNG.
 *
 * @param input - Filesystem path or in-memory bytes of the source image.
 * @param outputPath - Filesystem path for the resulting `.png` file.
 * @param width - Square edge length in pixels, a positive integer. Defaults to `320`, the 160 CSS px grid cell at DPR 2.
 * @param options - Tone space for the diffusion.
 * @returns A promise resolving once the file is written; it rejects on Sharp or filesystem errors, which callers must handle.
 * @throws {RangeError} If `width` or `tone` is invalid or Sharp returns an unexpected pixel layout.
 */
export async function ditherWithSharp(
  input: string | Uint8Array,
  outputPath: string,
  width = 320,
  options: MonoOptions = {},
) {
  const { tone = "gamma" } = options;
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new RangeError(`Width must be a positive integer, got ${width}`);
  }
  if (tone !== "gamma" && tone !== "linear") {
    throw new RangeError(`Tone must be "gamma" or "linear", got ${tone}`);
  }
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(input)
    .autoOrient()
    .flatten({ background: "#ffffff" })
    .resize(width, width, { fit: "cover" })
    .toColourspace("srgb")
    // Recovers edge contrast lost to downscaling, which 1-bit dithering would otherwise smear away.
    .sharpen({ sigma: 0.9 })
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true });

  if (
    info.width !== width || info.height !== width || info.channels !== 3 ||
    data.length !== width * width * 3
  ) {
    throw new RangeError(
      `Expected ${width}×${width}×3 8-bit sRGB from Sharp, got ${info.width}×${info.height}×${info.channels} (${data.length} bytes)`,
    );
  }

  const luma = levels(linearLuminance(data, 3).map(linearToSrgb));
  const field = tone === "linear" ? luma.map(srgbDecode) : luma;
  const mask = floydSteinberg(field, width, width);

  const greyAlpha = new Uint8Array(mask.length * 2);
  for (let i = 0; i < mask.length; i++) greyAlpha[i * 2 + 1] = mask[i] * 255;

  // Exactly two input colours fit a 2-entry palette losslessly; dither 0 makes sure libimagequant cannot move any pixel.
  await sharp(greyAlpha, { raw: { width, height: width, channels: 2 } })
    .png({ palette: true, colours: 2, dither: 0, effort: 10 })
    .toFile(outputPath);
}
