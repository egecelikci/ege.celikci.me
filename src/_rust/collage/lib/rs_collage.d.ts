// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

export class Color {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  r: number;
  g: number;
  b: number;
}

export class Layout {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  item_size: number;
  corner_radius: number;
  list_base_y: number;
  list_row_height: number;
  cols: number;
  rows: number;
}

export function calculate_layout(cols: number, rows: number,): Layout;

export function get_grid_coordinates(cols: number, rows: number,): Float32Array;

export function get_vibrant_color(data: Uint8Array,): Color;

export function render_background(
  data: Uint8Array,
  width: number,
  height: number,
  grid_colors: Uint8Array,
  aura_intensity: number,
  grain_amount: number,
  noise_type: number,
  mesh_cols: number,
  mesh_rows: number,
): void;
