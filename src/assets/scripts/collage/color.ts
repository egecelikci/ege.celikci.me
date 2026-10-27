/**
 * Dominant-colour sampling for the collage background.
 *
 * Ported from the wasm crate: it scans a downscaled 20×20 thumbnail and keeps the most saturated pixel whose lightness sits away from both ends, so a cover that is almost black or almost white does not wash out the mesh. `color.test.ts` pins it against vectors captured from the wasm original.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Used when nothing in the image is saturated enough; matches the site's background tint. */
export const FALLBACK_COLOR: Rgb = { r: 30, g: 27, b: 75 };

/** Lightness window a candidate must sit inside to be considered. */
const MIN_LIGHTNESS = 0.2;
const MAX_LIGHTNESS = 0.8;

/**
 * Most saturated, non-extreme colour in RGBA pixel data.
 *
 * @param rgba - Pixels, four bytes each; a trailing partial pixel is ignored.
 * @returns The chosen colour, or {@link FALLBACK_COLOR} when nothing qualifies.
 */
export function vibrantColor(rgba: Uint8Array): Rgb {
  let best = FALLBACK_COLOR;
  let maxSaturation = 0;

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];

    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;
    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const lightness = (max + min) / 2;

    const saturation = max === min
      ? 0
      : lightness > 0.5
      ? (max - min) / (2 - max - min)
      : (max - min) / (max + min);

    if (
      saturation > maxSaturation &&
      lightness > MIN_LIGHTNESS &&
      lightness < MAX_LIGHTNESS
    ) {
      maxSaturation = saturation;
      best = { r, g, b };
    }
  }

  return best;
}
