/**
 * Collage Generator Worker (Architect Edition - Dynamic Layouts)
 * OffscreenCanvas-based rendering with Rust/WASM acceleration.
 *
 * Rendering pipeline (order matters):
 *   1. Fonts
 *   2. Layout + cover fetching
 *   3. Color sampling + thermal clamping
 *   4. WASM background render → putImageData
 *   5. JS style overlays (velvet/silver tints, terminal phosphor, vignette)
 *   6. Glass blur [OPTIONAL] — applied to background layer only, before covers
 *   7. Grid tiles (covers — always sharp, never tinted)
 *   8. Album list text (strict high-contrast white/zinc, never color-tinted)
 *   9. darkenBottom gradient
 *  10. Footer / branding
 *  11. Encode to JPEG
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

const WORKER_DEFAULT_FONTS: { family: string; url: string; weight: string }[] =
  [
    {
      family: "Josefin Sans",
      url: "/assets/fonts/josefin-sans-normal-100-700-latin.woff2",
      weight: "100 700",
    },
    {
      family: "Inconsolata",
      url: "/assets/fonts/inconsolata-100-normal-200-900-latin.woff2",
      weight: "200 900",
    },
  ];

let defaultFontsLoaded = false;

async function ensureDefaultFonts() {
  if (defaultFontsLoaded) return;
  await Promise.all(
    WORKER_DEFAULT_FONTS.map(async ({ family, url, weight }) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Local font fetch failed: ${res.status}`);
        const buffer = await res.arrayBuffer();
        // @ts-ignore
        const font = new FontFace(family, buffer, { weight });
        await font.load();
        // @ts-ignore
        self.fonts.add(font);
        console.log(`[worker] local font loaded: ${family}`);
      } catch (e) {
        console.error(`[worker] local font failed: ${family}`, e);
      }
    }),
  );
  defaultFontsLoaded = true;
}

async function fetchCover(
  album: Album,
): Promise<{ album: Album; bitmap: ImageBitmap | null }> {
  let res: Response | undefined;

  // 1. Try direct image URL first (Last.fm provides these)
  if (album.img) {
    try {
      res = await fetch(album.img);
    } catch (_e) {}
  }

  // 2. Fall back to CAA via proxy if direct URL missing or failed
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

async function getVibrantColor(
  img: ImageBitmap | null,
): Promise<{ r: number; g: number; b: number }> {
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

async function loadFont(family: string, weight = "400") {
  try {
    const res = await fetch(
      `/api/collage-proxy?source=font&family=${
        encodeURIComponent(family)
      }&weight=${weight}`,
    );
    if (!res.ok) {
      console.error(
        `[worker] font proxy error ${res.status}: ${family} w${weight}`,
      );
      return;
    }
    const buffer = await res.arrayBuffer();
    // @ts-ignore
    const font = new FontFace(family, buffer, { weight });
    await font.load();
    // @ts-ignore
    self.fonts.add(font);
    console.log(`[worker] font loaded: ${family} w${weight}`);
  } catch (e) {
    console.error(`[worker] font loading failed: ${family} w${weight}`, e);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, canvas, albums, options } = e.data;
  if (type !== "generate") return;

  const offscreen = canvas as OffscreenCanvas;
  const ctx = offscreen.getContext("2d", { alpha: false });
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
    // ── PHASE 1: FONTS ──────────────────────────────────────────────────────────

    if (!defaultFontsLoaded) {
      self.postMessage({ type: "status", text: "loading default fonts" });
      await ensureDefaultFonts();
    }

    if (
      fontFamily &&
      fontFamily !== "Josefin Sans" &&
      fontFamily !== "Inconsolata"
    ) {
      self.postMessage({ type: "status", text: `loading font: ${fontFamily}` });
      await Promise.all(["400", "700"].map((w) => loadFont(fontFamily, w)));
    }

    // ── PHASE 2: LAYOUT + COVER FETCHING ────────────────────────────────────────

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

    self.postMessage({ type: "status", text: "resolving artwork URLs" });
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
    // Pad with empty slots if we ran out of source albums
    while (finalAlbums.length < targetCount) {
      finalAlbums.push({ name: "", artist: "", count: 0 });
      finalImages.push(null);
    }

    // ── PHASE 3: COLOR SAMPLING + THERMAL CLAMPING ──────────────────────────────

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

    // Thermal: clamp vibrant colors into stark thermal-camera palette BEFORE
    // passing to WASM, so the mesh gradient uses the harsh banded colors.
    if (bgMode === "thermal") {
      for (let i = 0; i < gridColors.length; i += 3) {
        const avg = (gridColors[i] + gridColors[i + 1] + gridColors[i + 2]) / 3;
        if (avg < 85) {
          // Cold → deep electric blue
          gridColors[i] = 10;
          gridColors[i + 1] = 20;
          gridColors[i + 2] = 180;
        } else if (avg < 170) {
          // Warm → vibrant red
          gridColors[i] = 235;
          gridColors[i + 1] = 35;
          gridColors[i + 2] = 15;
        } else {
          // Hot → bright yellow
          gridColors[i] = 255;
          gridColors[i + 1] = 215;
          gridColors[i + 2] = 20;
        }
      }
    }

    // ── PHASE 4: WASM BACKGROUND RENDER ─────────────────────────────────────────

    self.postMessage({
      type: "status",
      text: "compositing background layer natively",
    });

    let bgModeNum = 0;
    if (bgMode === "silver") bgModeNum = 1;
    else if (bgMode === "velvet") bgModeNum = 2;
    else if (bgMode === "terminal") bgModeNum = 3;
    else if (bgMode === "thermal") bgModeNum = 4;
    else if (bgMode === "dark") bgModeNum = 5;

    // Terminal gets structural scanline grain regardless of applyGrain toggle;
    // Silver gets heavier grain for its analog-film character.
    const grainAmount = bgMode === "terminal"
      ? 0.22
      : bgMode === "silver"
      ? applyGrain ? 0.14 : 0.0
      : applyGrain
      ? 0.05
      : 0.0;

    const auraIntensity = bgMode === "aura"
      ? 0.6
      : bgMode === "thermal"
      ? 0.72
      : bgMode === "velvet"
      ? 0.5
      : bgMode === "silver"
      ? 0.45
      : 0.0;

    const imageData = ctx.createImageData(W, H);
    // Pass the underlying ArrayBuffer directly — zero extra copies.
    const pixelData = new Uint8Array(imageData.data.buffer);

    // Rust now handles ALL layers: gaussian splat aura, glass frosted tint,
    // velvet gradient, silver desat+sheen, terminal phosphor, vignette,
    // and darkenBottom.
    render_background(
      pixelData,
      W,
      H,
      gridColors,
      auraIntensity,
      grainAmount,
      bgModeNum,
      applyGlass,
      darkenBottom,
      cols,
      rows,
    );

    imageData.data.set(pixelData);
    ctx.putImageData(imageData, 0, 0);

    // ── PHASE 5: GRID TILES ──────────────────────────────────────────────────────
    // Covers are always drawn at full opacity, full saturation, no blending effects.

    self.postMessage({
      type: "status",
      text: `drawing ${targetCount} grid tiles`,
    });
    for (let i = 0; i < targetCount; i++) {
      const x = gridCoords[i * 2];
      const y = gridCoords[i * 2 + 1];

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
      } else {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x, y, layout.item_size, layout.item_size);
      }
      ctx.restore();

      // Subtle border to lift tiles off the background
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
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

    // ── PHASE 6: ALBUM LIST ──────────────────────────────────────────────────────
    // Text is strictly high-contrast white/zinc. Terminal gets phosphor green
    // on the text itself, matching the CRT aesthetic, but never warm/cool tinting.

    const listLimit = Math.min(finalAlbums.length, rows > 4 ? 12 : 9);
    self.postMessage({
      type: "status",
      text: `rendering album list (${listLimit} entries)`,
    });

    const customFont = fontFamily ? `'${fontFamily}', ${FONT_SANS}` : FONT_SANS;
    const customMono = fontFamily ? `'${fontFamily}', ${FONT_MONO}` : FONT_MONO;

    ctx.textRendering = "geometricPrecision";

    const isTerminal = bgMode === "terminal";
    const trackNumColor = isTerminal
      ? "rgba(0,255,80,0.50)"
      : "rgba(255,255,255,0.40)";
    const albumTitleColor = isTerminal ? "#00ff50" : "#f4f4f5";
    const artistColor = isTerminal
      ? "rgba(0,255,80,0.40)"
      : "rgba(255,255,255,0.35)";
    const countColor = isTerminal
      ? "rgba(0,255,80,0.40)"
      : "rgba(255,255,255,0.30)";

    for (let i = 0; i < listLimit; i++) {
      const y = layout.list_base_y + i * layout.list_row_height;

      ctx.textAlign = "left";
      ctx.fillStyle = trackNumColor;
      ctx.font = `bold 24px ${customMono}`;
      ctx.fillText(`${i + 1}. `, MARGIN, y);

      ctx.fillStyle = albumTitleColor;
      ctx.font = `900 ${rows > 4 ? 20 : 24}px ${customFont}`;
      ctx.fillText(
        transformText(finalAlbums[i].name.substring(0, 40), textCase),
        MARGIN + 40,
        y,
      );

      ctx.fillStyle = artistColor;
      ctx.font = `500 ${rows > 4 ? 14 : 18}px ${customFont}`;
      ctx.fillText(
        transformText(finalAlbums[i].artist.substring(0, 50), textCase),
        MARGIN + 40,
        y + (rows > 4 ? 22 : 28),
      );

      if (showCounts && finalAlbums[i].count > 0) {
        ctx.textAlign = "right";
        ctx.fillStyle = countColor;
        ctx.font = `bold ${rows > 4 ? 12 : 14}px ${customMono}`;
        ctx.fillText(
          `${finalAlbums[i].count} PLAYS`,
          W - MARGIN,
          y + (rows > 4 ? 22 : 28),
        );
      }
    }

    // ── PHASE 7: FOOTER / BRANDING ──────────────────────────────────────────────
    let footerText = footer || "";
    if (!footerText) {
      const now = new Date();
      const mY = now.toLocaleDateString("en-US", {
        month: "numeric",
        year: "2-digit",
      });
      const mD = now.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
      });
      const periodMap: Record<string, string> = {
        this_week: `top albums • week of ${mD}`,
        this_month: `top albums • ${mY}`,
        this_year: `top albums • ${now.getFullYear()}`,
        week: `top albums • week of ${mD}`,
        month: `top albums • ${mY}`,
        quarter: `top albums • past quarter (${mY})`,
        half_year: `top albums • past 6 months (${mY})`,
        year: `top albums • ${now.getFullYear()}`,
        all_time: "top albums • all time",
      };
      footerText = periodMap[period] || `top albums • ${period}`;
    }

    const brandingColor = isTerminal
      ? "rgba(0,255,80,0.20)"
      : "rgba(255,255,255,0.20)";
    ctx.textAlign = "center";
    ctx.fillStyle = brandingColor;
    ctx.font = `bold 16px ${customMono}`;
    ctx.letterSpacing = "8px";
    ctx.fillText(
      transformText(
        `TOP ALBUMS • ${period.replace(/_/g, " ")} • ${user}`,
        textCase,
      ),
      W / 2,
      H - 100,
    );
    ctx.letterSpacing = "2px";
    if (showSite) {
      ctx.fillText(transformText("EGE.CELIKCI.ME", textCase), W / 2, H - 72);
    }

    // ── PHASE 11: ENCODE ─────────────────────────────────────────────────────────
    self.postMessage({ type: "status", text: "encoding canvas to JPEG" });
    const blob = await offscreen.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });
    self.postMessage({ type: "done", blob });
  } catch (err: unknown) {
    self.postMessage({ type: "error", message: String(err) });
  }
};
