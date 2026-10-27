/**
 * Background compositor for the collage, in TypeScript.
 *
 * This is the same separable mesh the wasm crate computes: the Gaussian splat
 * `exp(-(dx² + dy²) · 5)` factors into one column table and one row table, so the
 * per-pixel work is a handful of multiply-adds. Everything after the mesh — glass,
 * velvet, silver, terminal, vignette, darken, grain — is per-pixel arithmetic.
 *
 * Kept dependency-free and allocation-free in the hot loop so it can be compared
 * against the wasm build on equal terms.
 */

/** Background palettes, in the order the worker and the kernel agree on. */
export const BG_MODE = {
  aura: 0,
  silver: 1,
  velvet: 2,
  terminal: 3,
  thermal: 4,
  dark: 5,
} as const;

export interface BackgroundInput {
  /** RGBA buffer, `width * height * 4` bytes; written in place. */
  data: Uint8Array;
  width: number;
  height: number;
  /** Mesh colours, row-major RGB, `meshCols * meshRows * 3` bytes. */
  gridColors: Uint8Array;
  meshCols: number;
  meshRows: number;
  /** 0…1 strength of the mesh, after which the fade to the page background applies. */
  auraIntensity: number;
  /** 0…1 amount of per-pixel grain. */
  grainAmount: number;
  bgMode: number;
  applyGlass: boolean;
  darkenBottom: boolean;
}

const BG_R = 9;
const BG_G = 9;
const BG_B = 11;

/**
 * Fill `data` with the background for `bgMode`.
 *
 * @returns `false`, leaving `data` untouched, when the size or mesh invariants do not hold.
 */
export function renderBackground(input: BackgroundInput): boolean {
  const {
    data,
    width,
    height,
    gridColors,
    meshCols,
    meshRows,
    auraIntensity,
    grainAmount,
    bgMode,
    applyGlass,
    darkenBottom,
  } = input;

  if (width < 2 || height < 2 || meshCols < 2 || meshRows < 2) return false;
  if (gridColors.length < meshCols * meshRows * 3) return false;
  if (data.length < width * height * 4) return false;

  const grainMul = grainAmount * 255;
  const invW = 1 / width;
  const invH = 1 / height;
  const aspect = width / height;
  const blockCols = (width >> 3) + 1;
  const mesh = bgMode !== BG_MODE.thermal && bgMode !== BG_MODE.dark;

  let colWeight: Float32Array | undefined;
  let colTotal: Float32Array | undefined;
  let rowWeight: Float32Array | undefined;
  let rowTotal: Float32Array | undefined;
  let meshSum: Float32Array | undefined;

  if (mesh) {
    // Column falloff per mesh column, and the mesh colours already weighted by it.
    colWeight = new Float32Array(meshCols * width);
    colTotal = new Float32Array(width);
    for (let mc = 0; mc < meshCols; mc++) {
      const cx = (mc + 0.5) / meshCols;
      const offset = mc * width;
      for (let x = 0; x < width; x++) {
        const dx = (x * invW - cx) * aspect;
        const weight = Math.exp(-dx * dx * 5);
        colWeight[offset + x] = weight;
        colTotal[x] += weight;
      }
    }

    meshSum = new Float32Array(meshRows * width * 3);
    for (let mr = 0; mr < meshRows; mr++) {
      for (let x = 0; x < width; x++) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        for (let mc = 0; mc < meshCols; mc++) {
          const base = (mr * meshCols + mc) * 3;
          const cw = colWeight[mc * width + x];
          sr += gridColors[base] * cw;
          sg += gridColors[base + 1] * cw;
          sb += gridColors[base + 2] * cw;
        }
        const at = (mr * width + x) * 3;
        meshSum[at] = sr;
        meshSum[at + 1] = sg;
        meshSum[at + 2] = sb;
      }
    }

    // Row falloff, one value per mesh row per y.
    rowWeight = new Float32Array(meshRows * height);
    rowTotal = new Float32Array(height);
    for (let mr = 0; mr < meshRows; mr++) {
      const cy = (mr + 0.5) / meshRows;
      const offset = mr * height;
      for (let y = 0; y < height; y++) {
        const dy = y * invH - cy;
        const weight = Math.exp(-dy * dy * 5);
        rowWeight[offset + y] = weight;
        rowTotal[y] += weight;
      }
    }
  }

  // Thermal's blocky blend derives its mesh indices from x and y alone. V8 cannot hoist the
  // fract/floor work the way LLVM does for the Rust build, so tabulate it once.
  let thermalRows: Float32Array | undefined;
  let thermalCols: Float32Array | undefined;
  if (bgMode === BG_MODE.thermal) {
    thermalRows = new Float32Array(height * 3);
    for (let y = 0; y < height; y++) {
      const rowF = y * invH * (meshRows - 1);
      const rIdx = Math.min(Math.floor(rowF), meshRows - 2);
      const at = y * 3;
      thermalRows[at] = (rIdx * meshCols) * 3;
      thermalRows[at + 1] = Math.floor((rowF % 1) * 4) / 4;
      thermalRows[at + 2] = 0;
    }
    thermalCols = new Float32Array(width * 3);
    for (let x = 0; x < width; x++) {
      const colF = x * invW * (meshCols - 1);
      const cIdx = Math.min(Math.floor(colF), meshCols - 2);
      const at = x * 3;
      thermalCols[at] = cIdx * 3;
      thermalCols[at + 1] = Math.floor((colF % 1) * 4) / 4;
      thermalCols[at + 2] = 0;
    }
  }

  // Thermal quantises the mesh weights into quarters, so the blended colour is identical for every
  // pixel inside a block. Recomputing it per pixel cost 14 reads and 6 lerps for nothing; the block
  // key only changes every few pixels.
  let cachedRowKey = Number.NaN;
  let cachedColKey = Number.NaN;
  let blockR = 0;
  let blockG = 0;
  let blockB = 0;

  for (let y = 0; y < height; y++) {
    const v = y * invH;
    const scanlineNoise = bgMode === BG_MODE.terminal
      ? (y % 3 === 0 ? grainMul * 0.45 : -grainMul * 0.15)
      : 0;
    const fade = (1 - v) * (1 - v) * auraIntensity;
    const darken = darkenBottom && v > 0.6
      ? 1 - Math.min(1, (v - 0.6) / 0.4) * 0.4
      : 1;

    for (let x = 0; x < width; x++) {
      let r = BG_R;
      let g = BG_G;
      let b = BG_B;

      if (bgMode !== BG_MODE.dark) {
        if (bgMode === BG_MODE.thermal) {
          const rowAt = y * 3;
          const colAt = x * 3;
          const rowOffset = thermalRows![rowAt];
          const colOffset = thermalCols![colAt];
          const rowKey = rowOffset + thermalRows![rowAt + 1];
          const colKey = colOffset + thermalCols![colAt + 1];

          if (rowKey !== cachedRowKey || colKey !== cachedColKey) {
            const weightR = rowKey - rowOffset;
            const weightC = colKey - colOffset;
            const tl = rowOffset + colOffset;
            const tr = tl + 3;
            const bl = tl + meshCols * 3;
            const br = bl + 3;
            blockR = mix(
              mix(gridColors[tl], gridColors[tr], weightC),
              mix(gridColors[bl], gridColors[br], weightC),
              weightR,
            );
            blockG = mix(
              mix(gridColors[tl + 1], gridColors[tr + 1], weightC),
              mix(gridColors[bl + 1], gridColors[br + 1], weightC),
              weightR,
            );
            blockB = mix(
              mix(gridColors[tl + 2], gridColors[tr + 2], weightC),
              mix(gridColors[bl + 2], gridColors[br + 2], weightC),
              weightR,
            );
            cachedRowKey = rowKey;
            cachedColKey = colKey;
          }

          r = blockR;
          g = blockG;
          b = blockB;
        } else {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (let mr = 0; mr < meshRows; mr++) {
            const weight = rowWeight![mr * height + y];
            const at = (mr * width + x) * 3;
            sr += meshSum![at] * weight;
            sg += meshSum![at + 1] * weight;
            sb += meshSum![at + 2] * weight;
          }
          const total = colTotal![x] * rowTotal![y];
          if (total > 0) {
            r = sr / total;
            g = sg / total;
            b = sb / total;
          }
        }

        r = BG_R + (r - BG_R) * fade;
        g = BG_G + (g - BG_G) * fade;
        b = BG_B + (b - BG_B) * fade;
      }

      if (applyGlass && bgMode !== BG_MODE.dark) {
        r = r * 0.94 + 255 * 0.06;
        g = g * 0.94 + 255 * 0.06;
        b = b * 0.94 + 255 * 0.06;
      }

      if (bgMode === BG_MODE.velvet) {
        const amount = Math.min(1, v / 0.7);
        r = mix(r, 9, amount);
        g = mix(g, 9, amount);
        b = mix(b, 11, amount);
      } else if (bgMode === BG_MODE.silver) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum;
        g = lum;
        b = lum;
        const sheen = 0.08 +
          (0.5 - Math.abs((x * invW + v) * 0.5 - 0.5)) * 0.14;
        r += 255 * sheen;
        g += 255 * sheen;
        b += 255 * sheen;
      } else if (bgMode === BG_MODE.terminal) {
        r = mix(r, 0, 0.09);
        g = mix(g, 255, 0.09);
        b = mix(b, 80, 0.09);
      }

      if (bgMode !== BG_MODE.dark && bgMode !== BG_MODE.terminal) {
        const dx = x * invW - 0.5;
        const dy = v - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const vig = Math.min(1, Math.max(0, (dist - 0.4) / 0.45));
        r *= 1 - vig * 0.4;
        g *= 1 - vig * 0.4;
        b *= 1 - vig * 0.4;
      }

      if (darkenBottom && v > 0.6) {
        r *= darken;
        g *= darken;
        b *= darken;
      }

      const noise = bgMode === BG_MODE.terminal
        ? scanlineNoise
        : bgMode === BG_MODE.thermal
        ? (wangHashPositive(y * width + x) ? 0.4 : -0.4) * grainMul
        : bgMode === BG_MODE.silver
        ? wangHash((y >> 3) * blockCols + (x >> 3)) * grainMul
        : wangHash(y * width + x) * grainMul;

      const at = (y * width + x) * 4;
      data[at] = clamp(r + noise);
      data[at + 1] = clamp(g + noise);
      data[at + 2] = clamp(b + noise);
      data[at + 3] = 255;
    }
  }

  return true;
}

/** Linear interpolation, matching the kernel's `lerp`. */
function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp to a byte. */
function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Sign of the Wang hash without the float conversion.
 *
 * `wangHash(seed) > 0` is the top bit of the mixed value being set, except for the single value
 * `0x80000000`, which maps to exactly 0 and so is not greater. Testing that avoids a float division
 * per pixel, which is what made the thermal mode the slowest path.
 */
function wangHashPositive(seed: number): boolean {
  let x = seed >>> 0;
  x = ((x ^ 61) ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x9e3779b9) >>> 0;
  x ^= x >>> 4;
  x = Math.imul(x, 0x27d4eb2d) >>> 0;
  x ^= x >>> 15;
  x >>>= 0;
  return x >= 0x80000000 && x !== 0x80000000;
}

/** Wang hash: a u32 seed to a float in [-0.5, 0.5], wrapping exactly as the Rust version does. */
function wangHash(seed: number): number {
  let x = seed >>> 0;
  x = ((x ^ 61) ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x9e3779b9) >>> 0;
  x ^= x >>> 4;
  x = Math.imul(x, 0x27d4eb2d) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296 - 0.5;
}
