use wasm_bindgen::prelude::*;

/// Fill `data` (RGBA, `width * height * 4` bytes) with the background for `bg_mode`.
///
/// `grid_colors` is the mesh in row-major RGB, `mesh_cols * mesh_rows * 3` bytes. `bg_mode` selects the palette: 0 aura, 1 silver, 2 velvet, 3 terminal, 4 thermal, 5 dark; anything else renders as aura.
///
/// Returns `false` and leaves `data` untouched when the size or mesh invariants do not hold, which is the only failure mode a caller has to handle.
#[wasm_bindgen]
pub fn render_background(
    data: &mut [u8],
    width: u32,
    height: u32,
    grid_colors: &[u8],
    aura_intensity: f32,
    grain_amount: f32,
    bg_mode: u32, // 0: aura, 1: silver, 2: velvet, 3: terminal, 4: thermal, 5: dark
    apply_glass: bool,
    darken_bottom: bool,
    mesh_cols: u32,
    mesh_rows: u32,
) -> bool {
    // A mesh needs at least 2x2 corners to interpolate between; the loops below subtract 2 without checking, which used to wrap and read out of bounds.
    if width < 2 || height < 2 || mesh_cols < 2 || mesh_rows < 2 {
        return false;
    }

    // Compare in usize: the u32 products overflow for large canvases long before the buffers would.
    let expected_grid = mesh_cols as usize * mesh_rows as usize * 3;
    let expected_data = width as usize * height as usize * 4;
    if grid_colors.len() < expected_grid || data.len() < expected_data {
        return false;
    }

    let bg_r = 9.0f32;
    let bg_g = 9.0f32;
    let bg_b = 11.0f32;
    let grain_mul = grain_amount * 255.0;
    let inv_w = 1.0 / width as f32;
    let inv_h = 1.0 / height as f32;
    let block_cols = width / 8 + 1;

    let aspect = width as f32 / height as f32;

    // The Gaussian splat is separable: exp(-(dx^2 + dy^2) * 5) = exp(-dx^2 * 5) * exp(-dy^2 * 5).
    // Evaluating the two 1D falloffs once per axis turns the per-pixel mesh sum into a handful of
    // multiply-adds, instead of an `exp` per mesh cell per pixel (millions per collage).
    let w = width as usize;
    let h = height as usize;
    let mcols = mesh_cols as usize;
    let mrows = mesh_rows as usize;

    // Only the mesh modes need these; thermal and dark would otherwise allocate ~130 KB per call for nothing.
    let mut col_weight: Vec<f32> = Vec::new();
    let mut col_total: Vec<f32> = Vec::new();
    if bg_mode != 4 && bg_mode != 5 {
        col_weight = vec![0f32; mcols * w];
        col_total = vec![0f32; w];
        for mc in 0..mcols {
            let cx = (mc as f32 + 0.5) / mesh_cols as f32;
            for x in 0..w {
                let u = x as f32 * inv_w;
                let dx = (u - cx) * aspect;
                let weight = (-dx * dx * 5.0).exp();
                col_weight[mc * w + x] = weight;
                col_total[x] += weight;
            }
        }
    }

    // Column sums per mesh row: `mesh_sum[mr][x] = sum over mc of colour * falloff`, so the pixel loop
    // only has to fold in the row falloff instead of walking the whole mesh again.
    let mut mesh_sum: Vec<f32> = Vec::new();
    if bg_mode != 4 && bg_mode != 5 {
        mesh_sum = vec![0f32; mrows * w * 3];
        for mr in 0..mrows {
            for x in 0..w {
                let mut sr = 0.0;
                let mut sg = 0.0;
                let mut sb = 0.0;
                for mc in 0..mcols {
                    let (cr, cg, cb) = get_mesh_color(grid_colors, mr, mc, mcols);
                    let cw = col_weight[mc * w + x];
                    sr += cr * cw;
                    sg += cg * cw;
                    sb += cb * cw;
                }
                let base = (mr * w + x) * 3;
                mesh_sum[base] = sr;
                mesh_sum[base + 1] = sg;
                mesh_sum[base + 2] = sb;
            }
        }
    }

    let mut row_weight: Vec<f32> = Vec::new();
    let mut row_total: Vec<f32> = Vec::new();
    if bg_mode != 4 && bg_mode != 5 {
        row_weight = vec![0f32; mrows * h];
        row_total = vec![0f32; h];
        for mr in 0..mrows {
            let cy = (mr as f32 + 0.5) / mesh_rows as f32;
            for y in 0..h {
                let v = y as f32 * inv_h;
                let dy = v - cy;
                let weight = (-dy * dy * 5.0).exp();
                row_weight[mr * h + y] = weight;
                row_total[y] += weight;
            }
        }
    }

    for y in 0..h {
        let v = y as f32 * inv_h;

        let scanline_noise = if bg_mode == 3 {
            if y % 3 == 0 {
                grain_mul * 0.45
            } else {
                -grain_mul * 0.15
            }
        } else {
            0.0
        };

        for x in 0..width as usize {
            let u = x as f32 * inv_w;

            let mut r = bg_r;
            let mut g = bg_g;
            let mut b = bg_b;

            if bg_mode != 5 {
                if bg_mode == 4 {
                    // Restore blocky mesh grid for thermal mode ("chessboard / square shaped thingy")
                    let col_f = u * (mesh_cols - 1) as f32;
                    let c_idx = (col_f.floor() as usize).min(mcols - 2);
                    let c_next = c_idx + 1;
                    let row_f = v * (mesh_rows - 1) as f32;
                    let r_idx = (row_f.floor() as usize).min(mrows - 2);
                    let r_next = r_idx + 1;
                    let block_r_weight = (row_f.fract() * 4.0).floor() / 4.0;
                    let block_c_weight = (col_f.fract() * 4.0).floor() / 4.0;

                    let c_tl = get_mesh_color(grid_colors, r_idx, c_idx, mcols);
                    let c_tr = get_mesh_color(grid_colors, r_idx, c_next, mcols);
                    let c_bl = get_mesh_color(grid_colors, r_next, c_idx, mcols);
                    let c_br = get_mesh_color(grid_colors, r_next, c_next, mcols);

                    r = lerp(lerp(c_tl.0, c_tr.0, block_c_weight), lerp(c_bl.0, c_br.0, block_c_weight), block_r_weight);
                    g = lerp(lerp(c_tl.1, c_tr.1, block_c_weight), lerp(c_bl.1, c_br.1, block_c_weight), block_r_weight);
                    b = lerp(lerp(c_tl.2, c_tr.2, block_c_weight), lerp(c_bl.2, c_br.2, block_c_weight), block_r_weight);
                } else {
                    // Separable form: the column sums are already weighted, so each row only needs its own falloff.
                    let mut sum_r = 0.0;
                    let mut sum_g = 0.0;
                    let mut sum_b = 0.0;

                    for mr in 0..mrows {
                        let weight = row_weight[mr * h + y];
                        let base = (mr * w + x) * 3;
                        sum_r += mesh_sum[base] * weight;
                        sum_g += mesh_sum[base + 1] * weight;
                        sum_b += mesh_sum[base + 2] * weight;
                    }

                    let sum_w = col_total[x] * row_total[y];
                    if sum_w > 0.0 {
                        r = sum_r / sum_w;
                        g = sum_g / sum_w;
                        b = sum_b / sum_w;
                    }
                }

                let fade = (1.0 - v).powi(2) * aura_intensity;
                r = bg_r + (r - bg_r) * fade;
                g = bg_g + (g - bg_g) * fade;
                b = bg_b + (b - bg_b) * fade;
            }

            if apply_glass && bg_mode != 5 {
                // Background is smoothly blended by Gaussian splats. Add frosted tint.
                r = r * 0.94 + 255.0 * 0.06;
                g = g * 0.94 + 255.0 * 0.06;
                b = b * 0.94 + 255.0 * 0.06;
            }

            if bg_mode == 2 { // velvet
                let mix = (v / 0.7).clamp(0.0, 1.0);
                r = lerp(r, 9.0, mix);
                g = lerp(g, 9.0, mix);
                b = lerp(b, 11.0, mix);
            } else if bg_mode == 1 { // silver
                let lum = 0.299 * r + 0.587 * g + 0.114 * b;
                r = lum; g = lum; b = lum;

                let sheen_pos = (u + v) * 0.5;
                let sheen_val = 0.08 + (0.5 - (sheen_pos - 0.5).abs()) * 0.14;
                r += 255.0 * sheen_val;
                g += 255.0 * sheen_val;
                b += 255.0 * sheen_val;
            } else if bg_mode == 3 { // terminal
                r = lerp(r, 0.0, 0.09);
                g = lerp(g, 255.0, 0.09);
                b = lerp(b, 80.0, 0.09);
            }

            if bg_mode != 5 && bg_mode != 3 { // vignette
                let dx = u - 0.5;
                let dy = v - 0.5;
                let dist = (dx*dx + dy*dy).sqrt();
                let vig = ((dist - 0.4) / (0.85 - 0.4)).clamp(0.0, 1.0);
                r *= 1.0 - vig * 0.4;
                g *= 1.0 - vig * 0.4;
                b *= 1.0 - vig * 0.4;
            }

            if darken_bottom {
                if v > 0.6 {
                    let dark_fade = ((v - 0.6) / 0.4).clamp(0.0, 1.0);
                    r *= 1.0 - dark_fade * 0.4;
                    g *= 1.0 - dark_fade * 0.4;
                    b *= 1.0 - dark_fade * 0.4;
                }
            }

            let noise = if bg_mode == 3 {
                scanline_noise
            } else if bg_mode == 4 {
                let h = wang_hash((y * w + x) as u32);
                if h > 0.0 { 0.4 * grain_mul } else { -0.4 * grain_mul }
            } else if bg_mode == 1 {
                let bx = x / 8;
                let by = y / 8;
                wang_hash((by * block_cols as usize + bx) as u32) * grain_mul
            } else {
                wang_hash((y * w + x) as u32) * grain_mul
            };

            let idx = (y * w + x) * 4;
            data[idx]     = (r + noise).clamp(0.0, 255.0) as u8;
            data[idx + 1] = (g + noise).clamp(0.0, 255.0) as u8;
            data[idx + 2] = (b + noise).clamp(0.0, 255.0) as u8;
            data[idx + 3] = 255;
        }
    }

    true
}

#[inline(always)]
fn get_mesh_color(grid: &[u8], row: usize, col: usize, mesh_cols: usize) -> (f32, f32, f32) {
    let base = (row * mesh_cols + col) * 3;
    (grid[base] as f32, grid[base + 1] as f32, grid[base + 2] as f32)
}

/// Wang hash: maps a u32 seed to a f32 in the range [-0.5, 0.5].
/// Fast, good distribution, no branching.
#[inline(always)]
fn wang_hash(mut seed: u32) -> f32 {
    seed = (seed ^ 61) ^ (seed >> 16);
    seed = seed.wrapping_mul(0x9e3779b9);
    seed ^= seed >> 4;
    seed = seed.wrapping_mul(0x27d4eb2d);
    seed ^= seed >> 15;
    (seed as f32 / u32::MAX as f32) - 0.5
}

#[inline(always)]
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}
