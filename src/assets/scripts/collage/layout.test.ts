/**
 * Grid geometry tests.
 *
 * Every expected value here was captured by calling the wasm original (`calculate_layout`, `get_grid_coordinates`) before it was replaced, so this is an equivalence check rather than a restatement of the implementation.
 */

import { assertEquals } from "@std/assert";
import {
  calculateLayout,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  gridCoordinates,
} from "./layout.ts";

Deno.test("calculateLayout matches the wasm vectors", () => {
  const expected = {
    "3x3": { itemSize: 286, cornerRadius: 16, listRowHeight: 76 },
    "4x4": { itemSize: 218, cornerRadius: 16, listRowHeight: 76 },
    "5x5": { itemSize: 171, cornerRadius: 8, listRowHeight: 60 },

    "1x1": { itemSize: 920, cornerRadius: 16, listRowHeight: 76 },
    "8x8": { itemSize: 101, cornerRadius: 8, listRowHeight: 60 },
  } as const;

  for (const [key, want] of Object.entries(expected)) {
    const [cols, rows] = key.split("x").map(Number);
    const layout = calculateLayout(cols, rows);
    assertEquals(
      {
        itemSize: layout.itemSize,
        cornerRadius: layout.cornerRadius,
        listRowHeight: layout.listRowHeight,
      },
      want,
      key,
    );
    assertEquals(layout.listBaseY, 1120, key);
    assertEquals([layout.cols, layout.rows], [cols, rows], key);
  }
});

Deno.test("gridCoordinates matches the wasm vectors", () => {
  assertEquals(Array.from(gridCoordinates(1, 1)), [80, 80]);

  // 445px tile, 30px gap, 80px margin; a single row is centred in the top 1080px.
  assertEquals(Array.from(gridCoordinates(2, 1)), [80, 317.5, 555, 317.5]);
  // A 2x2 grid is 920px tall, so it starts at 80px.
  assertEquals(
    Array.from(gridCoordinates(2, 2)),
    [80, 80, 555, 80, 80, 555, 555, 555],
  );
  // A 3x3 grid is 918px tall with 16px gaps, so it starts at 81px.
  assertEquals(Array.from(gridCoordinates(3, 3)).slice(0, 4), [
    80,
    81,
    396,
    81,
  ]);
});

Deno.test("gridCoordinates lays tiles out row-major", () => {
  const coords = gridCoordinates(2, 2);
  assertEquals(coords.length, 8);
  // First two tiles share a row, the next two share the following one.
  assertEquals(coords[1], coords[3]);
  assertEquals(coords[0], coords[4]);
  assertEquals(coords[5], coords[7]);
  assertEquals(coords[5] > coords[1], true);
});

Deno.test("the grid stays inside the canvas for every grid the page can send", () => {
  for (let cols = 1; cols <= 8; cols++) {
    for (let rows = 1; rows <= 8; rows++) {
      const layout = calculateLayout(cols, rows);
      const coords = gridCoordinates(cols, rows);
      let maxX = 0;
      let maxY = 0;
      for (let i = 0; i < coords.length; i += 2) {
        maxX = Math.max(maxX, coords[i] + layout.itemSize);
        maxY = Math.max(maxY, coords[i + 1] + layout.itemSize);
      }
      assertEquals(maxX <= CANVAS_WIDTH, true, `${cols}x${rows} width`);
      // The grid is centred in the top area, above the album list.
      assertEquals(maxY <= layout.listBaseY, true, `${cols}x${rows} height`);
      assertEquals(CANVAS_HEIGHT > layout.listBaseY, true);
    }
  }
});

Deno.test("an impossible grid is clamped instead of dividing by zero", () => {
  const layout = calculateLayout(0, 0);
  assertEquals(layout.cols, 1);
  assertEquals(layout.rows, 1);
  assertEquals(Number.isFinite(layout.itemSize), true);
  assertEquals(layout.itemSize > 0, true);
  assertEquals(gridCoordinates(0, 0).length, 2);
});

Deno.test("the two grids the wasm overflowed are scaled to fit", () => {
  // The wasm returned 286 for 3x4, which is 1234px tall in a 1080px area; 247 gives 1078px.
  assertEquals(calculateLayout(3, 4).itemSize, 247);
  // And 445 for 2x6, which is 2820px tall; 155 gives 1080px.
  assertEquals(calculateLayout(2, 6).itemSize, 155);

  for (let cols = 1; cols <= 8; cols++) {
    for (let rows = 1; rows <= 8; rows++) {
      const { itemSize, listBaseY } = calculateLayout(cols, rows);
      const gap = cols > 3 ? 16 : 30;
      const height = rows * itemSize + (rows - 1) * gap;
      assertEquals(height <= listBaseY, true, `${cols}x${rows} = ${height}px`);
    }
  }
});
