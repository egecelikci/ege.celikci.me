// @generated file from wasmbuild -- do not edit
// @ts-nocheck: generated
// deno-lint-ignore-file
// deno-fmt-ignore-file

let wasm;
export function __wbg_set_wasm(val,) {
  wasm = val;
}

function getArrayF32FromWasm0(ptr, len,) {
  ptr = ptr >>> 0;
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len,);
}

function getArrayU8FromWasm0(ptr, len,) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len,);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
  if (
    cachedFloat32ArrayMemory0 === null
    || cachedFloat32ArrayMemory0.byteLength === 0
  ) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer,);
  }
  return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len,) {
  ptr = ptr >>> 0;
  return decodeText(ptr, len,);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (
    cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0
  ) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer,);
  }
  return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc,) {
  const ptr = malloc(arg.length * 1, 1,) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1,);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}

let cachedTextDecoder = new TextDecoder("utf-8", {
  ignoreBOM: true,
  fatal: true,
},);
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len,) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", {
      ignoreBOM: true,
      fatal: true,
    },);
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(
    getUint8ArrayMemory0().subarray(ptr, ptr + len,),
  );
}

let WASM_VECTOR_LEN = 0;

const ColorFinalization = (typeof FinalizationRegistry === "undefined")
  ? { register: () => {}, unregister: () => {}, }
  : new FinalizationRegistry((ptr,) => wasm.__wbg_color_free(ptr >>> 0, 1,));

const LayoutFinalization = (typeof FinalizationRegistry === "undefined")
  ? { register: () => {}, unregister: () => {}, }
  : new FinalizationRegistry((ptr,) => wasm.__wbg_layout_free(ptr >>> 0, 1,));

export class Color {
  static __wrap(ptr,) {
    ptr = ptr >>> 0;
    const obj = Object.create(Color.prototype,);
    obj.__wbg_ptr = ptr;
    ColorFinalization.register(obj, obj.__wbg_ptr, obj,);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ColorFinalization.unregister(this,);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_color_free(ptr, 0,);
  }
  /**
   * @returns {number}
   */
  get r() {
    const ret = wasm.__wbg_get_color_r(this.__wbg_ptr,);
    return ret;
  }
  /**
   * @param {number} arg0
   */
  set r(arg0,) {
    wasm.__wbg_set_color_r(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get g() {
    const ret = wasm.__wbg_get_color_g(this.__wbg_ptr,);
    return ret;
  }
  /**
   * @param {number} arg0
   */
  set g(arg0,) {
    wasm.__wbg_set_color_g(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get b() {
    const ret = wasm.__wbg_get_color_b(this.__wbg_ptr,);
    return ret;
  }
  /**
   * @param {number} arg0
   */
  set b(arg0,) {
    wasm.__wbg_set_color_b(this.__wbg_ptr, arg0,);
  }
}
if (Symbol.dispose) Color.prototype[Symbol.dispose] = Color.prototype.free;

export class Layout {
  static __wrap(ptr,) {
    ptr = ptr >>> 0;
    const obj = Object.create(Layout.prototype,);
    obj.__wbg_ptr = ptr;
    LayoutFinalization.register(obj, obj.__wbg_ptr, obj,);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    LayoutFinalization.unregister(this,);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_layout_free(ptr, 0,);
  }
  /**
   * @returns {number}
   */
  get item_size() {
    const ret = wasm.__wbg_get_layout_item_size(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set item_size(arg0,) {
    wasm.__wbg_set_layout_item_size(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get corner_radius() {
    const ret = wasm.__wbg_get_layout_corner_radius(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set corner_radius(arg0,) {
    wasm.__wbg_set_layout_corner_radius(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get list_base_y() {
    const ret = wasm.__wbg_get_layout_list_base_y(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set list_base_y(arg0,) {
    wasm.__wbg_set_layout_list_base_y(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get list_row_height() {
    const ret = wasm.__wbg_get_layout_list_row_height(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set list_row_height(arg0,) {
    wasm.__wbg_set_layout_list_row_height(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get cols() {
    const ret = wasm.__wbg_get_layout_cols(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set cols(arg0,) {
    wasm.__wbg_set_layout_cols(this.__wbg_ptr, arg0,);
  }
  /**
   * @returns {number}
   */
  get rows() {
    const ret = wasm.__wbg_get_layout_rows(this.__wbg_ptr,);
    return ret >>> 0;
  }
  /**
   * @param {number} arg0
   */
  set rows(arg0,) {
    wasm.__wbg_set_layout_rows(this.__wbg_ptr, arg0,);
  }
}
if (Symbol.dispose) Layout.prototype[Symbol.dispose] = Layout.prototype.free;

/**
 * @param {number} cols
 * @param {number} rows
 * @returns {Layout}
 */
export function calculate_layout(cols, rows,) {
  const ret = wasm.calculate_layout(cols, rows,);
  return Layout.__wrap(ret,);
}

/**
 * @param {number} cols
 * @param {number} rows
 * @returns {Float32Array}
 */
export function get_grid_coordinates(cols, rows,) {
  const ret = wasm.get_grid_coordinates(cols, rows,);
  var v1 = getArrayF32FromWasm0(ret[0], ret[1],).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 4, 4,);
  return v1;
}

/**
 * @param {Uint8Array} data
 * @returns {Color}
 */
export function get_vibrant_color(data,) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc,);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.get_vibrant_color(ptr0, len0,);
  return Color.__wrap(ret,);
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array} grid_colors
 * @param {number} aura_intensity
 * @param {number} grain_amount
 * @param {number} noise_type
 * @param {number} mesh_cols
 * @param {number} mesh_rows
 */
export function render_background(
  data,
  width,
  height,
  grid_colors,
  aura_intensity,
  grain_amount,
  noise_type,
  mesh_cols,
  mesh_rows,
) {
  var ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc,);
  var len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(grid_colors, wasm.__wbindgen_malloc,);
  const len1 = WASM_VECTOR_LEN;
  wasm.render_background(
    ptr0,
    len0,
    data,
    width,
    height,
    ptr1,
    len1,
    aura_intensity,
    grain_amount,
    noise_type,
    mesh_cols,
    mesh_rows,
  );
}

export function __wbg___wbindgen_copy_to_typed_array_db832bc4df7216c1(
  arg0,
  arg1,
  arg2,
) {
  new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength,).set(
    getArrayU8FromWasm0(arg0, arg1,),
  );
}

export function __wbg___wbindgen_throw_dd24417ed36fc46e(arg0, arg1,) {
  throw new Error(getStringFromWasm0(arg0, arg1,),);
}

export function __wbindgen_init_externref_table() {
  const table = wasm.__wbindgen_externrefs;
  const offset = table.grow(4,);
  table.set(0, undefined,);
  table.set(offset + 0, undefined,);
  table.set(offset + 1, null,);
  table.set(offset + 2, true,);
  table.set(offset + 3, false,);
}
