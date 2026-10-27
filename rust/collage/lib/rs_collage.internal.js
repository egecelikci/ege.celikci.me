// @generated file from wasmbuild -- do not edit
// @ts-nocheck: generated
// deno-lint-ignore-file
// deno-fmt-ignore-file

let wasm;
export function __wbg_set_wasm(val) {
  wasm = val;
}

function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (
    cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0
  ) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

let WASM_VECTOR_LEN = 0;

/**
 * Fill `data` (RGBA, `width * height * 4` bytes) with the background for `bg_mode`.
 *
 * `grid_colors` is the mesh in row-major RGB, `mesh_cols * mesh_rows * 3` bytes. `bg_mode` selects the palette: 0 aura, 1 silver, 2 velvet, 3 terminal, 4 thermal, 5 dark; anything else renders as aura.
 *
 * Returns `false` and leaves `data` untouched when the size or mesh invariants do not hold, which is the only failure mode a caller has to handle.
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} grid_colors
 * @param {number} aura_intensity
 * @param {number} grain_amount
 * @param {number} bg_mode
 * @param {boolean} apply_glass
 * @param {boolean} darken_bottom
 * @param {number} mesh_cols
 * @param {number} mesh_rows
 * @returns {boolean}
 */
export function render_background(
  data,
  width,
  height,
  grid_colors,
  aura_intensity,
  grain_amount,
  bg_mode,
  apply_glass,
  darken_bottom,
  mesh_cols,
  mesh_rows,
) {
  var ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  var len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(grid_colors, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.render_background(
    ptr0,
    len0,
    data,
    width,
    height,
    ptr1,
    len1,
    aura_intensity,
    grain_amount,
    bg_mode,
    apply_glass,
    darken_bottom,
    mesh_cols,
    mesh_rows,
  );
  return ret !== 0;
}

export function __wbg___wbindgen_copy_to_typed_array_db832bc4df7216c1(
  arg0,
  arg1,
  arg2,
) {
  new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(
    getArrayU8FromWasm0(arg0, arg1),
  );
}

export function __wbindgen_init_externref_table() {
  const table = wasm.__wbindgen_externrefs;
  const offset = table.grow(4);
  table.set(0, undefined);
  table.set(offset + 0, undefined);
  table.set(offset + 1, null);
  table.set(offset + 2, true);
  table.set(offset + 3, false);
}
