/**
 * Grid geometry for the collage.
 *
 * Ported from the wasm crate when it turned out to be two integer divisions and a double loop. The numbers are identical to the Rust originals — `layout.test.ts` pins them against vectors captured from the wasm — including the quirk that the grid is centred inside the top 1080px of a 1920px canvas, which is where the album list starts.
 */

/** Canvas width. The grid, the margins and the vertical centring all derive from it. */
export const CANVAS_WIDTH = 1080;
/** Canvas height. Only the caller needs it; the layout itself is width-driven. */
export const CANVAS_HEIGHT = 1920;
/** Space between the canvas edge and the grid. */
export const MARGIN = 80;
/**
 * Vertical space the grid may occupy, above the album list.
 *
 * The original wasm layout happened to fit every size the page offered, but a taller grid (3 columns by 4 rows is 1192px) overflowed it: tiles started above the canvas and ran into the list. Scaling to fit keeps that impossible by construction, and is a no-op for the 3x3, 4x4 and 5x5 grids the page actually offers.
 */
const TOP_AREA = CANVAS_WIDTH;

export interface Layout {
  /** Edge length of one square tile, in pixels. */
  itemSize: number;
  /** Corner radius applied to tiles and their borders. */
  cornerRadius: number;
  /** Y of the first album-list row. */
  listBaseY: number;
  /** Height of one album-list row; tighter grids get a tighter list. */
  listRowHeight: number;
  cols: number;
  rows: number;
}

/**
 * Tile size, corner radius and list metrics for a `cols × rows` grid.
 *
 * @param cols - Grid columns; clamped to at least 1.
 * @param rows - Grid rows; clamped to at least 1.
 * @returns The layout for that grid.
 */
export function calculateLayout(cols: number, rows: number): Layout {
  const safeCols = Math.max(1, Math.trunc(cols));
  const safeRows = Math.max(1, Math.trunc(rows));

  // Gaps close up as the grid gets denser.
  const gap = safeCols > 3 ? 16 : 30;
  const available = CANVAS_WIDTH - MARGIN * 2;
  // Integer division, as in the wasm original: tiles must stay whole pixels or the grid drifts.
  const widthFit = Math.floor((available - gap * (safeCols - 1)) / safeCols);
  const heightFit = Math.floor(
    (TOP_AREA - gap * (safeRows - 1)) / safeRows,
  );
  const itemSize = Math.max(1, Math.min(widthFit, heightFit));

  return {
    itemSize,
    cornerRadius: safeCols > 4 ? 8 : 16,
    listBaseY: 1120,
    listRowHeight: safeRows > 4 ? 60 : 76,
    cols: safeCols,
    rows: safeRows,
  };
}

/**
 * Top-left corner of every tile, row-major as `[x0, y0, x1, y1, …]`.
 *
 * @param cols - Grid columns.
 * @param rows - Grid rows.
 * @returns `cols * rows * 2` coordinates.
 */
export function gridCoordinates(cols: number, rows: number): Float32Array {
  const layout = calculateLayout(cols, rows);
  const gap = layout.cols > 3 ? 16 : 30;
  const step = layout.itemSize + gap;

  const gridHeight = layout.rows * layout.itemSize +
    (layout.rows - 1) * gap;
  const startY = (CANVAS_WIDTH - gridHeight) / 2;

  const coords = new Float32Array(layout.cols * layout.rows * 2);
  let i = 0;
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      coords[i++] = MARGIN + col * step;
      coords[i++] = startY + row * step;
    }
  }
  return coords;
}
