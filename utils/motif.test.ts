/**
 * Unit tests for the palette contrast helpers.
 */

import { assert, assertEquals } from "@std/assert";
import { contrast, onColor } from "./motif.ts";

const LIGHT_TEXT = "#172c66";
const DARK_TEXT = "#e8e2f3";

Deno.test("onColor prefers the palette's own text tokens", () => {
  assertEquals(onColor("#fef6e4", LIGHT_TEXT, DARK_TEXT), LIGHT_TEXT);
  assertEquals(onColor("#3a2a55", LIGHT_TEXT, DARK_TEXT), DARK_TEXT);
});

Deno.test("onColor falls back to black when no palette text token reads", () => {
  /** Dark `primaryOffset`: 3.95:1 against the better palette token. */
  assertEquals(onColor("#ef5a58", LIGHT_TEXT, DARK_TEXT), "#000000");
});

Deno.test("every palette color reaches the palette's own minimum", () => {
  const minimum = 4.5;
  const modes = [
    [
      "#fef6e4",
      "#f3e1d8",
      "#172c66",
      "#45527e",
      "#f3d2c1",
      "#e3b79d",
      "#a60c49",
      "#8a0a3d",
      "#2d6a7a",
    ],
    [
      "#3a2a55",
      "#4a3a6a",
      "#e8e2f3",
      "#d0c8e8",
      "#52427a",
      "#6b5794",
      "#ff8e8c",
      "#ef5a58",
      "#abd1c6",
    ],
  ];

  for (const hexes of modes) {
    for (const bg of hexes) {
      const text = onColor(bg, LIGHT_TEXT, DARK_TEXT, minimum);
      assert(
        contrast(bg, text) >= minimum,
        `${bg} with ${text} is ${contrast(bg, text).toFixed(2)}:1`,
      );
    }
  }
});
