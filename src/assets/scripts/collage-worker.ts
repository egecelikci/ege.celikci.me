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
  applyGrain: boolean;
  skipMissing: boolean;
  showCounts: boolean;
  user: string;
  period: string;
  cols: number;
  rows: number;
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

self.onmessage = async (e: MessageEvent) => {
  const { type, canvas, albums, options } = e.data;
  if (type !== "generate") return;
  const ctx = (canvas as OffscreenCanvas).getContext("2d", { alpha: false });
  if (!ctx) return;
  const {
    bgMode,
    applyGrain,
    skipMissing,
    showCounts,
    user,
    period,
    cols,
    rows,
  } = options as Options;

  try {
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
      const batchSize = sourceIndex === 0 ? targetCount : needed;
      const batch = albums.slice(sourceIndex, sourceIndex + batchSize);
      sourceIndex += batch.length;
      const results = await Promise.all(
        batch.map((a: Album) => fetchCover(a)),
      );
      for (const res of results) {
        self.postMessage({
          type: "status",
          text: `fetching cover art ${
            finalAlbums.length + 1
          } of ${targetCount}`,
        });
        if (res.bitmap || !skipMissing) {
          finalAlbums.push(res.album);
          finalImages.push(res.bitmap);
        }
        if (finalAlbums.length >= targetCount) break;
      }
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
    render_background(
      imageData.data,
      W,
      H,
      gridColors,
      (bgMode === "aura" || bgMode === "thermal") ? 0.6 : 0.0,
      applyGrain ? (bgMode === "silver" ? 0.15 : 0.05) : 0.0,
      bgMode === "thermal" ? 1 : (bgMode === "terminal" ? 2 : 0),
      cols,
      rows,
    );
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
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (bgMode === "silver") {
      // High contrast B&W / Silver overlay
      ctx.save();
      ctx.globalCompositeOperation = "saturation";
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, "rgba(255,255,255,0.1)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.2)");
      grad.addColorStop(1, "rgba(255,255,255,0.1)");
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (bgMode === "terminal") {
      ctx.save();
      ctx.fillStyle = "rgba(0, 255, 80, 0.15)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Global Vignette
    if (bgMode !== "dark") {
      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        W / 3,
        W / 2,
        H / 2,
        H * 0.8,
      );
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }

    // --- 3. THE GRID ---
    self.postMessage({
      type: "status",
      text: `drawing ${targetCount} grid tiles`,
    });
    for (let i = 0; i < targetCount; i++) {
      const x = gridCoords[i * 2], y = gridCoords[i * 2 + 1];
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
    for (let i = 0; i < listLimit; i++) {
      const y = layout.list_base_y + (i * layout.list_row_height);
      ctx.textAlign = "left";
      ctx.fillStyle = bgMode === "terminal"
        ? "rgba(0,255,80,0.5)"
        : "rgba(255,255,255,0.4)";
      ctx.font = `bold 24px ${FONT_MONO}`;
      ctx.fillText(`${i + 1}. `, MARGIN, y);

      ctx.fillStyle = bgMode === "terminal" ? "#00ff50" : "#f4f4f5";
      ctx.font = `900 ${rows > 4 ? 20 : 24}px ${FONT_SANS}`;
      ctx.fillText(
        finalAlbums[i].name.toUpperCase().substring(0, 40),
        MARGIN + 40,
        y,
      );

      ctx.fillStyle = bgMode === "terminal"
        ? "rgba(0,255,80,0.4)"
        : "rgba(255,255,255,0.35)";
      ctx.font = `500 ${rows > 4 ? 14 : 18}px ${FONT_SANS}`;
      ctx.fillText(
        finalAlbums[i].artist.toUpperCase().substring(0, 50),
        MARGIN + 40,
        y + (rows > 4 ? 22 : 28),
      );

      if (showCounts && finalAlbums[i].count > 0) {
        ctx.textAlign = "right";
        ctx.fillStyle = bgMode === "terminal"
          ? "rgba(0,255,80,0.4)"
          : "rgba(255,255,255,0.3)";
        ctx.font = `bold ${rows > 4 ? 12 : 14}px ${FONT_MONO}`;
        ctx.fillText(
          `${finalAlbums[i].count} PLAYS`,
          W - MARGIN,
          y + (rows > 4 ? 22 : 28),
        );
      }
    }

    // Branding
    ctx.textAlign = "center";
    ctx.fillStyle = bgMode === "terminal"
      ? "rgba(0,255,80,0.2)"
      : "rgba(255,255,255,0.2)";
    ctx.font = `bold 16px ${FONT_MONO}`;
    ctx.letterSpacing = "8px";
    ctx.fillText(
      `TOP ALBUMS • ${period.replace("_", " ")} • ${user}`.toUpperCase(),
      W / 2,
      H - 100,
    );
    ctx.letterSpacing = "2px";
    ctx.fillText("EGE.CELIKCI.ME", W / 2, H - 72);

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
