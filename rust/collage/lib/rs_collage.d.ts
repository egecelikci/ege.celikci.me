// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

/**
 * Fill `data` (RGBA, `width * height * 4` bytes) with the background for `bg_mode`.
 *
 * `grid_colors` is the mesh in row-major RGB, `mesh_cols * mesh_rows * 3` bytes. `bg_mode` selects the palette: 0 aura, 1 silver, 2 velvet, 3 terminal, 4 thermal, 5 dark; anything else renders as aura.
 *
 * Returns `false` and leaves `data` untouched when the size or mesh invariants do not hold, which is the only failure mode a caller has to handle.
 */
export function render_background(
  data: Uint8Array,
  width: number,
  height: number,
  grid_colors: Uint8Array,
  aura_intensity: number,
  grain_amount: number,
  bg_mode: number,
  apply_glass: boolean,
  darken_bottom: boolean,
  mesh_cols: number,
  mesh_rows: number,
): boolean;
