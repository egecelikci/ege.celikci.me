/**
 * Collage Generator Worker (Architect Edition - Dynamic Layouts)
 * OffscreenCanvas-based rendering with Rust/WASM acceleration.
 */

import {
  calculate_layout,
  get_grid_coordinates,
  get_vibrant_color,
  render_background,
} from "../../_rust/collage/lib/rs_collage.js";

interface Album {
  name: string;
  artist: string;
  count: number;
  mbid?: string;
  img?: string;
}

interface Options {
  bgMode: "aura" | "silver" | "velvet" | "terminal" | "thermal" | "dark";
  textCase: "none" | "upper" | "lower";
  applyGrain: boolean;
  applyGlass: boolean;
  darkenBottom: boolean;
  skipMissing: boolean;
  showCounts: boolean;
  showSite: boolean;
  user: string;
  period: string;
  cols: number;
  rows: number;
  footer?: string;
  fontFamily?: string;
}

const W = 1080;
const H = 1920;
const MARGIN = 80;
const FONT_SANS =
  "'Josefin Sans', 'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'Inconsolata', monospace";

async function fetchCover(
  album: Album,
): Promise<{ album: Album; bitmap: ImageBitmap | null }> {
  let res;
  if (album.img) {
    try {
      res = await fetch(album.img);
    } catch (_e) {}
  }
  if ((!res || !res.ok) && album.mbid) {
    try {
      res = await fetch(`/api/collage-proxy?source=cover&mbid=${album.mbid}`);
    } catch (_e) {}
  }
  let bitmap: ImageBitmap | null = null;
  if (res && res.ok) {
    try {
      const blob = await res.blob();
      bitmap = await createImageBitmap(blob);
    } catch (_e) {}
  }
  return { album, bitmap };
}

async function getVibrantColor(img: ImageBitmap | null) {
  if (!img) return { r: 30, g: 27, b: 75 };
  const mini = new OffscreenCanvas(20, 20);
  const mctx = mini.getContext("2d");
  if (!mctx) return { r: 30, g: 27, b: 75 };
  mctx.drawImage(img, 0, 0, 20, 20);
  const color = get_vibrant_color(mctx.getImageData(0, 0, 20, 20).data);
  return { r: color.r, g: color.g, b: color.b };
}

function transformText(text: string, casing: Options["textCase"]): string {
  if (casing === "upper") return text.toUpperCase();
  if (casing === "lower") return text.toLowerCase();
  return text;
}

async function loadFont(family: string) {
  if (!family || family === "Josefin Sans") return;
  try {
    const res = await fetch(
      `/api/collage-proxy?source=font&family=${encodeURIComponent(family)}`,
    );
    if (!res.ok) return;
    const buffer = await res.arrayBuffer();
    // @ts-ignore: FontFace might not be in the worker types yet
    const font = new FontFace(family, buffer);
    await font.load();
    // @ts-ignore: self.fonts might not be in the worker types yet
    self.fonts.add(font);
    console.log(`[worker] font loaded: ${family}`);
  } catch (e) {
    console.error(`[worker] font loading failed: ${family}`, e);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, canvas, albums, options } = e.data;
  if (type !== "generate") return;
  const ctx = (canvas as OffscreenCanvas).getContext("2d", { alpha: false });
  if (!ctx) return;
  const {
    bgMode,
    textCase,
    applyGrain,
    applyGlass,
    darkenBottom,
    skipMissing,
    showCounts,
    showSite,
    user,
    period,
    cols,
    rows,
    footer,
    fontFamily,
  } = options as Options;

  try {
    // Load custom font if requested
    if (fontFamily) {
      self.postMessage({ type: "status", text: `loading font: ${fontFamily}` });
      await loadFont(fontFamily);
    }

    self.postMessage({
      type: "status",
      text: `computing ${cols}×${rows} grid layout`,
    });
    const layout = calculate_layout(cols, rows);
    const gridCoords = get_grid_coordinates(cols, rows);
    const targetCount = cols * rows;

    const finalAlbums: Album[] = [];
    const finalImages: (ImageBitmap | null)[] = [];
    let sourceIndex = 0;

    self.postMessage({
      type: "status",
      text: "resolving artwork URLs",
    });
    while (finalAlbums.length < targetCount && sourceIndex < albums.length) {
      const needed = targetCount - finalAlbums.length;
      const batchSize = Math.min(needed, 10);
      const batch = albums.slice(sourceIndex, sourceIndex + batchSize);
      sourceIndex += batch.length;
      const results = await Promise.all(batch.map((a: Album) => fetchCover(a)));
      for (const res of results) {
        if (res.bitmap || !skipMissing) {
          finalAlbums.push(res.album);
          finalImages.push(res.bitmap);
        }
        if (finalAlbums.length >= targetCount) break;
      }
      self.postMessage({
        type: "status",
        text: `fetching cover art ${finalAlbums.length}/${targetCount}`,
      });
    }
    while (finalAlbums.length < targetCount) {
      finalAlbums.push({ name: "", artist: "", count: 0 });
      finalImages.push(null);
    }

    // --- 2. RENDER BACKGROUND (WASM) ---
    self.postMessage({
      type: "status",
      text: "sampling dominant colors from covers",
    });
    const gridColors = new Uint8Array(targetCount * 3);
    const colors = await Promise.all(
      finalImages.map((img) => getVibrantColor(img)),
    );
    for (let i = 0; i < targetCount; i++) {
      gridColors[i * 3] = colors[i].r;
      gridColors[i * 3 + 1] = colors[i].g;
      gridColors[i * 3 + 2] = colors[i].b;
    }

    if (bgMode === "thermal") {
      for (let i = 0; i < gridColors.length; i += 3) {
        const avg = (gridColors[i] + gridColors[i + 1] + gridColors[i + 2]) / 3;
        if (avg < 85) {
          gridColors[i] = 10;
          gridColors[i + 1] = 20;
          gridColors[i + 2] = 160;
        } else if (avg < 170) {
          gridColors[i] = 230;
          gridColors[i + 1] = 40;
          gridColors[i + 2] = 20;
        } else {
          gridColors[i] = 255;
          gridColors[i + 1] = 210;
          gridColors[i + 2] = 30;
        }
      }
    }

    self.postMessage({
      type: "status",
      text: "compositing background layer",
    });
    const imageData = ctx.createImageData(W, H);
    // Convert Uint8ClampedArray to Uint8Array for WASM
    const pixelData = new Uint8Array(imageData.data.buffer);
    render_background(
      pixelData,
      W,
      H,
      gridColors,
      bgMode === "aura" || bgMode === "thermal" ? 0.6 : 0.0,
      applyGrain ? (bgMode === "silver" ? 0.15 : 0.05) : 0.0,
      bgMode === "thermal" ? 1 : bgMode === "terminal" ? 2 : 0,
      cols,
      rows,
    );
    // Copy back to imageData
    imageData.data.set(pixelData);
    ctx.putImageData(imageData, 0, 0);

    // Style Overlays
    if (bgMode === "velvet") {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(
        0,
        `rgb(${gridColors[0]},${gridColors[1]},${gridColors[2]})`,
      );
      grad.addColorStop(0.7, "#09090b");
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (bgMode === "silver") {
      // High contrast B&W / Silver overlay
      ctx.save();
      ctx.globalCompositeOperation = "saturation";
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "rgba(255,255,255,0.08)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.15)");
      grad.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (bgMode === "terminal") {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "rgba(0, 255, 80, 0.15)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Global Vignette - reduced intensity for better brightness
    if (bgMode !== "dark") {
      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        W / 2.5,
        W / 2,
        H / 2,
        H * 0.85,
      );
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    // --- 3. THE GRID ---
    self.postMessage({
      type: "status",
      text: `drawing ${targetCount} grid tiles`,
    });
    for (let i = 0; i < targetCount; i++) {
      const x = gridCoords[i * 2],
        y = gridCoords[i * 2 + 1];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        x,
        y,
        layout.item_size,
        layout.item_size,
        layout.corner_radius,
      );
      ctx.clip();
      if (finalImages[i]) {
        ctx.drawImage(
          finalImages[i]!,
          x,
          y,
          layout.item_size,
          layout.item_size,
        );
        if (bgMode === "silver") {
          ctx.globalCompositeOperation = "luminosity";
          ctx.fillStyle = "rgba(255,255,255,0.1)";
          ctx.fillRect(x, y, layout.item_size, layout.item_size);
        }
      } else {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x, y, layout.item_size, layout.item_size);
      }
      ctx.restore();

      // Border
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(
        x,
        y,
        layout.item_size,
        layout.item_size,
        layout.corner_radius,
      );
      ctx.stroke();
      ctx.restore();
    }

    // --- 4. THE LIST ---
    const listLimit = Math.min(finalAlbums.length, rows > 4 ? 12 : 9);
    self.postMessage({
      type: "status",
      text: `rendering album list of ${listLimit} entries`,
    });

    const customFont = fontFamily ? `'${fontFamily}', ${FONT_SANS}` : FONT_SANS;
    const customMono = fontFamily ? `'${fontFamily}', ${FONT_MONO}` : FONT_MONO;

    for (let i = 0; i < listLimit; i++) {
      const y = layout.list_base_y + i * layout.list_row_height;
      ctx.textAlign = "left";
      ctx.fillStyle = bgMode === "terminal"
        ? "rgba(0,255,80,0.5)"
        : "rgba(255,255,255,0.4)";
      ctx.font = `bold 24px ${customMono}`;
      ctx.fillText(`${i + 1}. `, MARGIN, y);

      ctx.fillStyle = bgMode === "terminal" ? "#00ff50" : "#f4f4f5";
      ctx.font = `900 ${rows > 4 ? 20 : 24}px ${customFont}`;
      ctx.fillText(
        transformText(finalAlbums[i].name.substring(0, 40), textCase),
        MARGIN + 40,
        y,
      );

      ctx.fillStyle = bgMode === "terminal"
        ? "rgba(0,255,80,0.4)"
        : "rgba(255,255,255,0.35)";
      ctx.font = `500 ${rows > 4 ? 14 : 18}px ${customFont}`;
      ctx.fillText(
        transformText(finalAlbums[i].artist.substring(0, 50), textCase),
        MARGIN + 40,
        y + (rows > 4 ? 22 : 28),
      );

      if (showCounts && finalAlbums[i].count > 0) {
        ctx.textAlign = "right";
        ctx.fillStyle = bgMode === "terminal"
          ? "rgba(0,255,80,0.4)"
          : "rgba(255,255,255,0.3)";
        ctx.font = `bold ${rows > 4 ? 12 : 14}px ${customMono}`;
        ctx.fillText(
          `${finalAlbums[i].count} PLAYS`,
          W - MARGIN,
          y + (rows > 4 ? 22 : 28),
        );
      }
    }

    // Additional effects
    if (applyGlass) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (darkenBottom) {
      const grad = ctx.createLinearGradient(0, H * 0.6, 0, H);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H * 0.6, W, H * 0.4);
    }

    // --- 5. FOOTER ---
    let footerText = footer || "";
    if (!footerText) {
      const periodMap: Record<string, string> = {
        this_week: `top albums • week of ${
          new Date().toLocaleDateString(
            "en-US",
            {
              month: "numeric",
              day: "numeric",
            },
          )
        }`,
        this_month: `top albums • ${
          new Date().toLocaleDateString("en-US", {
            month: "numeric",
            year: "2-digit",
          })
        }`,
        this_year: `top albums • ${new Date().getFullYear()}`,
        week: `top albums • week of ${
          new Date().toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
          })
        }`,
        month: `top albums • ${
          new Date().toLocaleDateString("en-US", {
            month: "numeric",
            year: "2-digit",
          })
        }`,
        quarter: `top albums • past quarter (${
          new Date().toLocaleDateString(
            "en-US",
            {
              month: "numeric",
              year: "2-digit",
            },
          )
        })`,
        half_year: `top albums • past 6 months (${
          new Date().toLocaleDateString(
            "en-US",
            {
              month: "numeric",
              year: "2-digit",
            },
          )
        })`,
        year: `top albums • ${new Date().getFullYear()}`,
        all_time: "top albums • all time",
      };
      footerText = periodMap[period] || `top albums • ${period}`;
    }

    // Branding
    ctx.textAlign = "center";
    ctx.fillStyle = bgMode === "terminal"
      ? "rgba(0,255,80,0.2)"
      : "rgba(255,255,255,0.2)";
    ctx.font = `bold 16px ${customMono}`;
    ctx.letterSpacing = "8px";
    ctx.fillText(
      transformText(
        `TOP ALBUMS • ${period.replace("_", " ")} • ${user}`,
        textCase,
      ),
      W / 2,
      H - 100,
    );
    ctx.letterSpacing = "2px";
    if (showSite) {
      ctx.fillText(transformText("EGE.CELIKCI.ME", textCase), W / 2, H - 72);
    }

    self.postMessage({ type: "status", text: "encoding canvas to JPEG" });
    const blob = await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });
    self.postMessage({ type: "done", blob });
  } catch (err: unknown) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
