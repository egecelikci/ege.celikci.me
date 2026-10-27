/**
 * Dominant-colour tests.
 *
 * The vectors come from the wasm original (`get_vibrant_color`) so the port is checked against real behaviour, including the cases where nothing qualifies and the fallback wins.
 */

import { assertEquals } from "@std/assert";
import { FALLBACK_COLOR, vibrantColor } from "./color.ts";

const pixels = (...values: number[]) => new Uint8Array(values);

Deno.test("vibrantColor matches the wasm vectors", () => {
  const cases: Array<[string, Uint8Array, [number, number, number]]> = [
    ["saturated red", pixels(255, 0, 0, 255, 255, 0, 0, 255), [255, 0, 0]],
    ["grey", pixels(128, 128, 128, 255), [30, 27, 75]],
    ["dark navy", pixels(30, 27, 75, 255), [30, 27, 75]],
    ["bright green", pixels(0, 255, 80, 255), [0, 255, 80]],
    ["faint blue", pixels(200, 210, 255, 255), [30, 27, 75]],
    ["transparent black", pixels(0, 0, 0, 0, 0, 0, 0, 0), [30, 27, 75]],
    ["no pixels", pixels(), [30, 27, 75]],
  ];

  for (const [name, input, want] of cases) {
    const got = vibrantColor(input);
    assertEquals([got.r, got.g, got.b], want, name);
  }
});

Deno.test("vibrantColor keeps the first pixel among equally saturated ones", () => {
  const got = vibrantColor(
    pixels(255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255),
  );
  assertEquals([got.r, got.g, got.b], [255, 0, 0]);
});

Deno.test("vibrantColor prefers saturation over brightness", () => {
  // A pale tile first, then a saturated but dimmer one.
  const got = vibrantColor(pixels(230, 220, 210, 255, 200, 20, 20, 255));
  assertEquals([got.r, got.g, got.b], [200, 20, 20]);
});

Deno.test("vibrantColor ignores a trailing partial pixel", () => {
  const got = vibrantColor(pixels(255, 0, 0, 255, 0, 255));
  assertEquals([got.r, got.g, got.b], [255, 0, 0]);
});

Deno.test("vibrantColor never returns undefined fields", () => {
  const got = vibrantColor(pixels(0, 0, 0, 0));
  assertEquals(got, FALLBACK_COLOR);
});
