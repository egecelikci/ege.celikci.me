/**
 * Collage Generator Worker
 * OffscreenCanvas-based rendering for high-performance collage generation.
 */

interface Album {
  name: string;
  artist: string;
  count: number;
  mbid?: string;
  img?: string;
}

interface Options {
  bgMode: "aura" | "dark";
  applyGrain: boolean;
  showCounts: boolean;
  user: string;
  period: string;
}

const W = 1080;
const H = 1920;
const COVER_SIZE = 280;
const CORNER_RADIUS = 16;
const GRID_X = [80, 400, 720, 80, 400, 720, 80, 400, 720,];
const GRID_Y = [130, 130, 130, 450, 450, 450, 770, 770, 770,];
const LIST_BASE_Y = 1120;
const LIST_ROW_HEIGHT = 76;
const MARGIN = 80;

function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y,);
  ctx.lineTo(x + width - radius, y,);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius,);
  ctx.lineTo(x + width, y + height - radius,);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height,);
  ctx.lineTo(x + radius, y + height,);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius,);
  ctx.lineTo(x, y + radius,);
  ctx.quadraticCurveTo(x, y, x + radius, y,);
  ctx.closePath();
}

/**
 * Enhanced dominant color extraction.
 * Samples a grid from the image to find a vibrant "mood" color.
 */
function getVibrantColor(img: ImageBitmap | null,) {
  if (!img) return "#1e1b4b";

  const sampleSize = 10;
  const miniCanvas = new OffscreenCanvas(sampleSize, sampleSize,);
  const mctx = miniCanvas.getContext("2d",);
  if (!mctx) return "#1e1b4b";

  try {
    mctx.drawImage(img, 0, 0, sampleSize, sampleSize,);
    const data = mctx.getImageData(0, 0, sampleSize, sampleSize,).data;

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Skip very dark or very bright pixels to get better vibrance
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > 30 && brightness < 220) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }

    if (count === 0) return "#1e1b4b";
    return `rgb(${Math.round(r / count,)},${Math.round(g / count,)},${
      Math.round(b / count,)
    })`;
  } catch (_e) {
    return "#1e1b4b";
  }
}

/**
 * Renders a high-quality aura glow using a combination of hardware-accelerated
 * blur filters and bilinear scaling.
 */
function drawAuraImage(
  ctx: OffscreenCanvasRenderingContext2D,
  img: ImageBitmap,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  // We use a significant blur and saturation boost for that "cinematic" look
  ctx.filter = "blur(120px) saturate(1.6)";
  ctx.globalAlpha = 0.3;
  ctx.drawImage(img, x, y, size, size,);
  ctx.restore();
}

self.onmessage = async (e: MessageEvent,) => {
  const { type, canvas, albums, options, } = e.data;

  if (type !== "generate") return;

  const ctx = (canvas as OffscreenCanvas).getContext("2d", { alpha: false, },);
  if (!ctx) {
    self.postMessage({
      type: "error",
      message: "Failed to get canvas context",
    },);
    return;
  }

  const { bgMode, applyGrain, showCounts, user, period, } = options as Options;

  try {
    // 1. RESOURCE PIPELINE
    self.postMessage({ type: "status", text: "Streaming covers...", },);
    const images = await Promise.all(
      (albums as Album[]).map(async (album,) => {
        let res;
        if (album.img) {
          try {
            res = await fetch(album.img,);
          } catch (_e) {}
        }
        if ((!res || !res.ok) && album.mbid) {
          try {
            res = await fetch(
              `/api/collage-proxy?source=cover&mbid=${album.mbid}`,
            );
          } catch (_e) {}
        }
        if (res && res.ok) {
          try {
            const blob = await res.blob();
            return await createImageBitmap(blob,);
          } catch (_e) {
            return null;
          }
        }
        return null;
      },),
    );

    // 2. BACKGROUND ARCHITECTURE
    // Layer 1: Solid Base
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H,);

    if (bgMode === "aura") {
      const accentColor = getVibrantColor(images[0] ?? null,);

      // Layer 2: Ambient Mood Mesh (Top-weighted)
      const mesh = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H,);
      mesh.addColorStop(0, accentColor,);
      mesh.addColorStop(0.6, "#09090b",);
      ctx.fillStyle = mesh;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, 0, W, H,);
      ctx.globalAlpha = 1.0;

      // Layer 3: Dynamic Aura Glows
      // We use the first 3 images to create a multi-tone background
      for (let i = 0; i < Math.min(3, images.length,); i++) {
        if (images[i]) {
          const auraX = (i * 400) - 200;
          const auraY = 200;
          drawAuraImage(ctx, images[i]!, auraX, auraY, W,);
        }
      }

      // Layer 4: Cinematic Vignette (Outer-weighted)
      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        W / 3,
        W / 2,
        H / 2,
        W,
      );
      vig.addColorStop(0, "transparent",);
      vig.addColorStop(1, "rgba(0,0,0,0.7)",);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H,);
    }

    // 3. THE GRID
    self.postMessage({ type: "status", text: "Refining geometry...", },);
    for (let i = 0; i < albums.length; i++) {
      const x = GRID_X[i];
      const y = GRID_Y[i];
      ctx.save();
      drawRoundedRect(ctx, x, y, COVER_SIZE, COVER_SIZE, CORNER_RADIUS,);
      ctx.clip();
      if (images[i]) {
        ctx.drawImage(images[i]!, x, y, COVER_SIZE, COVER_SIZE,);
      } else {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x, y, COVER_SIZE, COVER_SIZE,);
      }
      ctx.restore();
    }

    // 4. THE LIST
    const GAP = 30;
    ctx.textBaseline = "middle";

    for (let i = 0; i < albums.length; i++) {
      const y = LIST_BASE_Y + (i * LIST_ROW_HEIGHT);
      const name = ((albums[i] as Album).name || "Unknown").toUpperCase();
      const artist = ((albums[i] as Album).artist || "Unknown").toUpperCase();

      let countWidth = 0;
      if (showCounts) {
        ctx.textAlign = "right";
        ctx.fillStyle = "#f4f4f5";
        ctx.font = "700 22px Inconsolata, monospace";
        const countText = `⨯${(albums[i] as Album).count}`;
        ctx.fillText(countText, W - MARGIN, y,);
        countWidth = ctx.measureText(countText,).width;
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#f4f4f5";
      ctx.font = "900 24px Inconsolata, monospace";
      const prefix = `${i + 1}. `;
      const prefixWidth = ctx.measureText(prefix,).width;
      const avail = W - (MARGIN * 2) - prefixWidth
        - (showCounts ? countWidth + GAP : 0);

      let display = name;
      if (ctx.measureText(name,).width > avail) {
        while (
          ctx.measureText(display + "...",).width > avail && display.length > 0
        ) {
          display = display.slice(0, -1,);
        }
        display += "...";
      }
      ctx.fillText(prefix + display, MARGIN, y,);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "500 20px Inconsolata, monospace";
      ctx.fillText(artist.substring(0, 50,).toUpperCase(), MARGIN, y + 32,);
    }

    // 5. NOISE ENGINE
    if (applyGrain) {
      const t = 128;
      const tile = new OffscreenCanvas(t, t,);
      const tctx = tile.getContext("2d",);
      if (tctx) {
        const imgData = tctx.createImageData(t, t,);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const v = Math.random() * 255;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
          imgData.data[i + 3] = 12;
        }
        tctx.putImageData(imgData, 0, 0,);

        const pattern = ctx.createPattern(tile, "repeat",);
        if (pattern) {
          ctx.save();
          ctx.globalCompositeOperation = "soft-light";
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, W, H,);
          ctx.restore();
        }
      }
    }

    // 6. BRANDING & FOOTER
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#52525b";
    ctx.textAlign = "center";
    ctx.font = "bold 18px Inconsolata, monospace";
    ctx.letterSpacing = "6px";
    ctx.fillText(
      `TOP ALBUMS • ${period.replace("_", " ",)} • ${user}`.toUpperCase(),
      W / 2,
      H - 100,
    );
    ctx.letterSpacing = "2px";
    ctx.fillText("EGE.CELIKCI.ME", W / 2, H - 70,);

    const blob = await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: 0.95,
    },);
    self.postMessage({ type: "done", blob, },);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err,);
    self.postMessage({ type: "error", message, },);
  }
};
