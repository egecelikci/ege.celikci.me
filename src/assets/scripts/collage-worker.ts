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

import { renderBackground } from "./collage/kernel.ts";
import { FALLBACK_COLOR, type Rgb, vibrantColor } from "./collage/color.ts";
import { calculateLayout, gridCoordinates, MARGIN } from "./collage/layout.ts";
import {
  type Album,
  bgModeIndex,
  type CollageOptions,
  parseCollageOptions,
  type TextCase,
  type WorkerResponse,
} from "./collage/types.ts";

const W = 1080;
const H = 1920;
const FONT_SANS = "'DM Sans', 'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'DM Mono', monospace";

const WORKER_DEFAULT_FONTS: { family: string; url: string; weight: string }[] =
  [
    {
      family: "DM Sans",
      url: "/assets/fonts/dm-sans-normal-100-1000-latin.woff2",
      weight: "100 1000",
    },
    {
      family: "DM Mono",
      url: "/assets/fonts/dm-mono-normal-400-latin.woff2",
      weight: "400",
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
        const font = new FontFace(family, buffer, { weight });
        await font.load();
        workerFonts().add(font);
        console.log(`[worker] local font loaded: ${family}`);
      } catch (e) {
        console.error(`[worker] local font failed: ${family}`, e);
      }
    }),
  );
  defaultFontsLoaded = true;
}

/** The worker's font set; TypeScript's DOM lib does not declare it on `self`. */
const workerFonts = () => (self as unknown as { fonts: FontFaceSet }).fonts;

async function fetchCover(
  album: Album,
): Promise<{ album: Album; bitmap: ImageBitmap | null }> {
  let res: Response | undefined;

  /** The proxy URL the stats came with first, then the release group's front cover. */
  const candidates = [
    album.img,
    album.mbid && `/api/collage-proxy?source=cover&mbid=${album.mbid}`,
  ].filter((url): url is string => !!url);

  for (const url of candidates) {
    res = await fetch(url).catch(() => undefined);
    if (res?.ok) break;
  }

  let bitmap: ImageBitmap | null = null;
  if (res?.ok) {
    // A corrupt or unsupported image leaves the tile empty instead of failing the collage.
    bitmap = await res.blob().then(createImageBitmap).catch(() => null);
  }
  return { album, bitmap };
}

/** One 20x20 scratch canvas for every cover; readback needs `willReadFrequently`. */
const SAMPLE_SIZE = 20;
const sampler = new OffscreenCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
const samplerCtx = sampler.getContext("2d", { willReadFrequently: true });

function getVibrantColor(img: ImageBitmap | null): Rgb {
  if (!img || !samplerCtx) return FALLBACK_COLOR;
  samplerCtx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  samplerCtx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const data = samplerCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  return vibrantColor(new Uint8Array(data.buffer));
}

function transformText(text: string, casing: TextCase): string {
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
    const font = new FontFace(family, buffer, { weight });
    await font.load();
    workerFonts().add(font);
    console.log(`[worker] font loaded: ${family} w${weight}`);
  } catch (e) {
    console.error(`[worker] font loading failed: ${family} w${weight}`, e);
  }
}

/** Post a response the page can switch on, keeping the shape in one shared union. */
function post(message: WorkerResponse) {
  self.postMessage(message);
}

self.onmessage = async (e: MessageEvent) => {
  const { type, canvas, albums, options } = e.data;
  if (type !== "generate") return;

  const offscreen = canvas as OffscreenCanvas;
  const ctx = offscreen.getContext("2d", { alpha: false });
  if (!ctx) {
    post({ type: "error", message: "canvas has no 2d context" });
    return;
  }

  let parsed: CollageOptions;
  try {
    parsed = parseCollageOptions(options);
  } catch (error) {
    post({ type: "error", message: (error as Error).message });
    return;
  }

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
  } = parsed;

  try {
    /** PHASE 1: FONTS */

    if (!defaultFontsLoaded) {
      post({ type: "status", text: "loading default fonts" });
      await ensureDefaultFonts();
    }

    if (
      fontFamily &&
      fontFamily !== "DM Sans" &&
      fontFamily !== "DM Mono"
    ) {
      post({ type: "status", text: `loading font: ${fontFamily}` });
      await Promise.all(["400", "700"].map((w) => loadFont(fontFamily, w)));
    }

    /** PHASE 2: LAYOUT + COVER FETCHING */

    post({
      type: "status",
      text: `computing ${cols}×${rows} grid layout`,
    });
    const layout = calculateLayout(cols, rows);
    const gridCoords = gridCoordinates(cols, rows);
    const targetCount = cols * rows;

    const finalAlbums: Album[] = [];
    const finalImages: (ImageBitmap | null)[] = [];
    let sourceIndex = 0;

    post({ type: "status", text: "resolving artwork URLs" });
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
      post({
        type: "status",
        text: `fetching cover art ${finalAlbums.length}/${targetCount}`,
      });
    }
    /** Pad with empty slots if we ran out of source albums */
    while (finalAlbums.length < targetCount) {
      finalAlbums.push({ name: "", artist: "", count: 0 });
      finalImages.push(null);
    }

    /** PHASE 3: COLOR SAMPLING + THERMAL CLAMPING */

    post({
      type: "status",
      text: "sampling dominant colors from covers",
    });
    const gridColors = new Uint8Array(targetCount * 3);
    const colors = finalImages.map((img) => getVibrantColor(img));
    for (let i = 0; i < targetCount; i++) {
      gridColors[i * 3] = colors[i].r;
      gridColors[i * 3 + 1] = colors[i].g;
      gridColors[i * 3 + 2] = colors[i].b;
    }

    /**
     * Thermal: clamp vibrant colors into stark thermal-camera palette BEFORE
     * passing to WASM, so the mesh gradient uses the harsh banded colors.
     */
    if (bgMode === "thermal") {
      for (let i = 0; i < gridColors.length; i += 3) {
        const avg = (gridColors[i] + gridColors[i + 1] + gridColors[i + 2]) / 3;
        if (avg < 85) {
          /** Cold → deep electric blue */
          gridColors[i] = 10;
          gridColors[i + 1] = 20;
          gridColors[i + 2] = 180;
        } else if (avg < 170) {
          /** Warm → vibrant red */
          gridColors[i] = 235;
          gridColors[i + 1] = 35;
          gridColors[i + 2] = 15;
        } else {
          /** Hot → bright yellow */
          gridColors[i] = 255;
          gridColors[i + 1] = 215;
          gridColors[i + 2] = 20;
        }
      }
    }

    /** PHASE 4: WASM BACKGROUND RENDER */

    post({
      type: "status",
      text: "compositing background layer natively",
    });

    const bgModeNum = bgModeIndex(bgMode);

    /**
     * Terminal gets structural scanline grain regardless of applyGrain toggle;
     * Silver gets heavier grain for its analog-film character.
     */
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
    /** Pass the underlying ArrayBuffer directly — zero extra copies. */
    const pixelData = new Uint8Array(imageData.data.buffer);

    /**
     * Rust now handles ALL layers: gaussian splat aura, glass frosted tint,
     * velvet gradient, silver desat+sheen, terminal phosphor, vignette,
     * and darkenBottom.
     */
    const rendered = renderBackground({
      data: pixelData,
      width: W,
      height: H,
      gridColors,
      meshCols: cols,
      meshRows: rows,
      auraIntensity,
      grainAmount,
      bgMode: bgModeNum,
      applyGlass,
      darkenBottom,
    });

    // The kernel rejects sizes or meshes it cannot honour instead of trapping, so a false here is a real error rather than a blank background.
    if (!rendered) {
      throw new Error(
        `background kernel rejected ${W}x${H} with a ${cols}x${rows} mesh`,
      );
    }

    ctx.putImageData(imageData, 0, 0);

    /**
     * PHASE 5: GRID TILES
     * Covers are always drawn at full opacity, full saturation, no blending effects.
     */

    post({
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
        layout.itemSize,
        layout.itemSize,
        layout.cornerRadius,
      );
      ctx.clip();
      if (finalImages[i]) {
        ctx.drawImage(
          finalImages[i]!,
          x,
          y,
          layout.itemSize,
          layout.itemSize,
        );
      } else {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x, y, layout.itemSize, layout.itemSize);
      }
      ctx.restore();

      /** Subtle border to lift tiles off the background */
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(
        x,
        y,
        layout.itemSize,
        layout.itemSize,
        layout.cornerRadius,
      );
      ctx.stroke();
      ctx.restore();
    }

    /**
     * PHASE 6: ALBUM LIST
     * Text is strictly high-contrast white/zinc. Terminal gets phosphor green
     * on the text itself, matching the CRT aesthetic, but never warm/cool tinting.
     */

    const listLimit = Math.min(finalAlbums.length, rows > 4 ? 12 : 9);
    post({
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
      const y = layout.listBaseY + i * layout.listRowHeight;

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

    /** PHASE 7: FOOTER / BRANDING */
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
        half_yearly: `top albums • past 6 months (${mY})`,
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

    /** PHASE 11: ENCODE */
    post({ type: "status", text: "encoding canvas to JPEG" });
    const blob = await offscreen.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });
    post({ type: "done", blob });
  } catch (err: unknown) {
    post({ type: "error", message: (err as Error)?.message ?? String(err) });
  }
};
