/**
 * Pinned output of the wasm collage kernel.
 *
 * The kernel is a 2M-pixel inner loop, so a refactor there is easy to get subtly wrong and impossible to eyeball. These hashes are the regression gate: any change to `rust/collage/src/lib.rs` that alters a rendered pixel makes them fail.
 *
 * A failing hash prints the new value; replace the entry only after confirming the change was intended.
 */

import { assertEquals } from "@std/assert";
import { render_background } from "../../../../rust/collage/lib/rs_collage.js";

/** 2x2 mesh with one saturated, one dark, one light and one mid tone. */
const GRID_2X2 = new Uint8Array([
  200,
  40,
  40,
  30,
  120,
  200,
  240,
  220,
  40,
  60,
  90,
  180,
]);

const MODES = [
  "aura",
  "silver",
  "velvet",
  "terminal",
  "thermal",
  "dark",
] as const;

/** Truncated SHA-256 of the rendered buffer; long enough to catch any pixel change. */
async function hash(buffer: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    buffer as Uint8Array<ArrayBuffer>,
  );
  return new Uint8Array(digest).toHex().slice(0, 16);
}

function render(width: number, height: number, mode: number): Promise<string> {
  const pixels = new Uint8Array(width * height * 4);
  render_background(
    pixels,
    width,
    height,
    GRID_2X2,
    0.6,
    0.05,
    mode,
    false,
    true,
    2,
    2,
  );
  return hash(pixels);
}

const GOLDEN_SMALL: Record<string, string> = {
  aura: "6a105acb4b739876",
  silver: "61198151ce7cdce9",
  velvet: "6e697dec6cc77eef",
  terminal: "75585f24e7432e8e",
  thermal: "4e23edba31b262a2",
  dark: "57d91b54680333b7",
};

/**
 * The two modes with the most work per pixel: the mesh splat and the scanline grain.
 *
 * These two moved when the mesh sum was made separable. That rewrite was checked against the previous kernel
 * pixel by pixel: max channel delta 1, mean delta 0.0000, every small-size vector unchanged. Any future change
 * should be held to the same standard rather than to these hashes alone.
 */
const GOLDEN_FULL: Record<string, string> = {
  aura: "79cf278fb55e8d8c",
  terminal: "8b20891562ca0dbe",
};

for (const [index, mode] of MODES.entries()) {
  Deno.test(`kernel renders ${mode} identically at 96x192`, async () => {
    assertEquals(await render(96, 192, index), GOLDEN_SMALL[mode]);
  });
}

for (const mode of ["aura", "terminal"] as const) {
  const index = MODES.indexOf(mode);
  Deno.test(`kernel renders ${mode} identically at 1080x1920`, async () => {
    assertEquals(await render(1080, 1920, index), GOLDEN_FULL[mode]);
  });
}

Deno.test("kernel output is stable across calls", async () => {
  assertEquals(await render(96, 192, 0), await render(96, 192, 0));
});

Deno.test("kernel rejects a mesh it cannot interpolate", () => {
  const pixels = () => new Uint8Array(64 * 64 * 4);
  const grid = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  for (const [cols, rows] of [[0, 2], [2, 0], [1, 1], [1, 2], [2, 1]]) {
    const data = pixels();
    const rendered = render_background(
      data,
      64,
      64,
      grid,
      0.6,
      0.05,
      0,
      false,
      false,
      cols,
      rows,
    );
    assertEquals(rendered, false, `mesh ${cols}x${rows}`);
    assertEquals(
      data.some((v) => v !== 0),
      false,
      `mesh ${cols}x${rows} wrote`,
    );
  }
});

Deno.test("kernel rejects a buffer that is too small for the canvas", () => {
  const grid = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const short = new Uint8Array(64 * 64 * 4 - 4);
  assertEquals(
    render_background(short, 64, 64, grid, 0.6, 0.05, 0, false, false, 2, 2),
    false,
  );
  const shortGrid = new Uint8Array(11);
  assertEquals(
    render_background(
      new Uint8Array(64 * 64 * 4),
      64,
      64,
      shortGrid,
      0.6,
      0.05,
      0,
      false,
      false,
      2,
      2,
    ),
    false,
  );
});

Deno.test("kernel accepts a valid call", () => {
  assertEquals(
    render_background(
      new Uint8Array(64 * 64 * 4),
      64,
      64,
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      0.6,
      0.05,
      0,
      false,
      false,
      2,
      2,
    ),
    true,
  );
});
