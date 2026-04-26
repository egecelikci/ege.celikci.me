use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Layout {
    pub item_size: u32,
    pub corner_radius: u32,
    pub list_base_y: u32,
    pub list_row_height: u32,
    pub cols: u32,
    pub rows: u32,
}

#[wasm_bindgen]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[wasm_bindgen]
pub fn calculate_layout(cols: u32, rows: u32) -> Layout {
    let canvas_w = 1080;
    let margin = 80;
    let available_w = canvas_w - (margin * 2);
    
    // Gap decreases as grid gets denser
    let gap = if cols > 3 { 16 } else { 30 };
    let item_size = (available_w - (gap * (cols - 1))) / cols;
    
    // Grid ends around Y=1000 to leave room for the list
    let list_base_y = 1120;
    
    Layout {
        item_size,
        corner_radius: if cols > 4 { 8 } else { 16 },
        list_base_y,
        list_row_height: if rows > 4 { 60 } else { 76 },
        cols,
        rows,
    }
}

#[wasm_bindgen]
pub fn get_grid_coordinates(cols: u32, rows: u32) -> Vec<f32> {
    let mut coords = Vec::with_capacity((cols * rows * 2) as usize);
    let layout = calculate_layout(cols, rows);
    let margin = 80.0;
    let gap = if cols > 3 { 16.0 } else { 30.0 };
    
    // Center the grid vertically in the top area (0 to 1100)
    let grid_h = (rows as f32 * layout.item_size as f32) + ((rows - 1) as f32 * gap);
    let start_y = (1080.0 - grid_h) / 2.0;

    for r in 0..rows {
        for c in 0..cols {
            coords.push(margin + (c as f32 * (layout.item_size as f32 + gap)));
            coords.push(start_y + (r as f32 * (layout.item_size as f32 + gap)));
        }
    }
    coords
}

#[wasm_bindgen]
pub fn get_vibrant_color(data: &[u8]) -> Color {
    let mut best_r = 30; let mut best_g = 27; let mut best_b = 75;
    let mut max_sat = 0.0;
    for chunk in data.chunks_exact(4) {
        let (r, g, b) = (chunk[0], chunk[1], chunk[2]);
        let rf = r as f32 / 255.0; let gf = g as f32 / 255.0; let bf = b as f32 / 255.0;
        let max = rf.max(gf).max(bf); let min = rf.min(gf).min(bf);
        let l = (max + min) / 2.0;
        let sat = if max == min { 0.0 } else if l > 0.5 { (max-min)/(2.0-max-min) } else { (max-min)/(max+min) };
        if sat > max_sat && l > 0.2 && l < 0.8 {
            max_sat = sat; best_r = r; best_g = g; best_b = b;
        }
    }
    Color { r: best_r, g: best_g, b: best_b }
}

#[wasm_bindgen]
pub fn render_background(
    data: &mut [u8],
    width: u32,
    height: u32,
    grid_colors: &[u8],
    aura_intensity: f32,
    grain_amount: f32,
    noise_type: u32, // 0: Fine, 1: Blocky, 2: Scanlines, 3: High Contrast
    mesh_cols: u32,
    mesh_rows: u32,
) {
    let expected_grid = (mesh_rows * mesh_cols * 3) as usize;
    let expected_data = (width * height * 4) as usize;
    if grid_colors.len() < expected_grid || data.len() < expected_data {
        return;
    }

    let bg_r = 9.0; let bg_g = 9.0; let bg_b = 11.0;
    let grain_mul = grain_amount * 255.0;
    let inv_w = 1.0 / width as f32; let inv_h = 1.0 / height as f32;
    let rows_m1 = (mesh_rows - 1) as f32;
    let cols_m1 = (mesh_cols - 1) as f32;

    for y in 0..height {
        let v = y as f32 * inv_h;
        let row_f = v * rows_m1;
        let r_idx = (row_f.floor() as usize).min(mesh_rows as usize - 2);
        let r_next = r_idx + 1;
        
        // Hoist noise_type check for row weight
        let r_weight = if noise_type == 1 { 
            (row_f.fract() * 4.0).floor() / 4.0 
        } else { 
            row_f.fract() 
        };
        
        let fade = (1.0 - v).powi(2) * aura_intensity;

        for x in 0..width {
            let u = x as f32 * inv_w;
            let col_f = u * cols_m1;
            let c_idx = (col_f.floor() as usize).min(mesh_cols as usize - 2);
            let c_next = c_idx + 1;
            
            let c_weight = if noise_type == 1 { 
                (col_f.fract() * 4.0).floor() / 4.0 
            } else { 
                col_f.fract() 
            };

            let c_tl = get_mesh_color(grid_colors, r_idx, c_idx, mesh_cols as usize);
            let c_tr = get_mesh_color(grid_colors, r_idx, c_next, mesh_cols as usize);
            let c_bl = get_mesh_color(grid_colors, r_next, c_idx, mesh_cols as usize);
            let c_br = get_mesh_color(grid_colors, r_next, c_next, mesh_cols as usize);

            let r = lerp(lerp(c_tl.0, c_tr.0, c_weight), lerp(c_bl.0, c_br.0, c_weight), r_weight);
            let g = lerp(lerp(c_tl.1, c_tr.1, c_weight), lerp(c_bl.1, c_br.1, c_weight), r_weight);
            let b = lerp(lerp(c_tl.2, c_tr.2, c_weight), lerp(c_bl.2, c_br.2, c_weight), r_weight);
            
            let noise = match noise_type {
                2 => (if y % 4 < 2 { 0.2 } else { -0.2 }) * grain_mul,
                3 => {
                    // High Contrast noise implementation
                    let h = wang_hash((y * width + x as u32) as u32);
                    if h > 0.0 { 0.4 * grain_mul } else { -0.4 * grain_mul }
                },
                _ => wang_hash((y * width + x as u32) as u32) * grain_mul,
            };

            let idx = (y as usize * width as usize + x as usize) * 4;
            data[idx] = (bg_r + (r - bg_r) * fade + noise).clamp(0.0, 255.0) as u8;
            data[idx + 1] = (bg_g + (g - bg_g) * fade + noise).clamp(0.0, 255.0) as u8;
            data[idx + 2] = (bg_b + (b - bg_b) * fade + noise).clamp(0.0, 255.0) as u8;
            data[idx + 3] = 255;
        }
    }
}

#[inline(always)]
fn get_mesh_color(grid: &[u8], row: usize, col: usize, mesh_cols: usize) -> (f32, f32, f32) {
    let base = (row * mesh_cols + col) * 3;
    (grid[base] as f32, grid[base + 1] as f32, grid[base + 2] as f32)
}

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
