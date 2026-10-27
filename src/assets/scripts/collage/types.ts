/**
 * The contract between the collage page, its worker and the wasm kernel.
 *
 * These types are shared so a change to an option name breaks the compiler on both sides instead of silently reaching the worker as `undefined`.
 */

export interface Album {
  name: string;
  artist: string;
  count: number;
  mbid?: string;
  img?: string;
}

/** Palette for the generated background; the index is what the wasm kernel takes. */
export const BG_MODES = [
  "aura",
  "silver",
  "velvet",
  "terminal",
  "thermal",
  "dark",
] as const;

export type BgMode = typeof BG_MODES[number];

export const TEXT_CASES = ["none", "upper", "lower"] as const;

export type TextCase = typeof TEXT_CASES[number];

/** Largest grid the page offers; keeps tiles above 100px. */
export const MAX_GRID = 8;

export interface CollageOptions {
  bgMode: BgMode;
  textCase: TextCase;
  applyGrain: boolean;
  applyGlass: boolean;
  darkenBottom: boolean;
  skipMissing: boolean;
  showCounts: boolean;
  showSite: boolean;
  user: string;
  period: string;
  cols: number;
  rows: number;
  footer: string;
  fontFamily: string;
}

/** Index the kernel expects for a mode; unknown modes fall back to aura, as the kernel does. */
export function bgModeIndex(mode: BgMode): number {
  return BG_MODES.indexOf(mode);
}

export interface GenerateMessage {
  type: "generate";
  canvas: OffscreenCanvas;
  albums: Album[];
  options: CollageOptions;
}

export type WorkerRequest = GenerateMessage;

export type WorkerResponse =
  | { type: "status"; text: string }
  | { type: "done"; blob: Blob }
  | { type: "error"; message: string };

/**
 * Validate what came off the DOM before it reaches the worker and the kernel.
 *
 * The page derives `cols`/`rows` by splitting a `<select>` value and `bgMode` from another select, so a markup change can send `NaN` or an unknown mode. The kernel rejects impossible meshes rather than trapping, but a rejection here is a clearer error than a blank canvas.
 *
 * @param raw - Untrusted options, typically assembled from form controls.
 * @returns The same options, narrowed to their declared types.
 * @throws When a grid size, mode or text case is not one the page offers.
 */
export function parseCollageOptions(
  raw: Record<string, unknown>,
): CollageOptions {
  const cols = toGridSize(raw.cols, "cols");
  const rows = toGridSize(raw.rows, "rows");

  const bgMode = raw.bgMode;
  if (!isBgMode(bgMode)) {
    throw new TypeError(`unknown background mode: ${String(bgMode)}`);
  }

  const textCase = raw.textCase;
  if (!isTextCase(textCase)) {
    throw new TypeError(`unknown text case: ${String(textCase)}`);
  }

  return {
    bgMode,
    textCase,
    cols,
    rows,
    applyGrain: raw.applyGrain === true,
    applyGlass: raw.applyGlass === true,
    darkenBottom: raw.darkenBottom === true,
    skipMissing: raw.skipMissing === true,
    showCounts: raw.showCounts === true,
    showSite: raw.showSite === true,
    user: typeof raw.user === "string" ? raw.user : "",
    period: typeof raw.period === "string" ? raw.period : "",
    footer: typeof raw.footer === "string" ? raw.footer : "",
    fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : "",
  };
}

export function isBgMode(value: unknown): value is BgMode {
  return typeof value === "string" && BG_MODES.some((mode) => mode === value);
}

export function isTextCase(value: unknown): value is TextCase {
  return typeof value === "string" &&
    TEXT_CASES.some((mode) => mode === value);
}

function toGridSize(value: unknown, name: string): number {
  const size = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(size) || size < 1 || size > MAX_GRID) {
    throw new RangeError(
      `${name} must be an integer in 1..${MAX_GRID}: ${String(value)}`,
    );
  }
  return size;
}
