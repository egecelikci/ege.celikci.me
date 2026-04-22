/**
 * Collage Generator Worker (Architect Edition - Grid-Mapped Aura)
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
  bgMode: "aura" | "chromatic" | "dark" | "silver" | "velvet";
  applyGrain: boolean;
  showCounts: boolean;
  user: string;
  period: string;
}

const W = 1080;
const H = 1920;
const COVER_SIZE = 280;
const CORNER_RADIUS = 12;
const GRID_X = [80, 400, 720, 80, 400, 720, 80, 400, 720,];
const GRID_Y = [130, 130, 130, 450, 450, 450, 770, 770, 770,];
const LIST_BASE_Y = 1120;
const LIST_ROW_HEIGHT = 76;
const MARGIN = 80;

// Typographic SSOT
const FONT_SANS =
  "'Josefin Sans', 'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'Inconsolata', monospace";

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

function getVibrantColor(img: ImageBitmap | null,) {
  if (!img) return "rgb(30, 27, 75)";
  const sampleSize = 10;
  const miniCanvas = new OffscreenCanvas(sampleSize, sampleSize,);
  const mctx = miniCanvas.getContext("2d",);
  if (!mctx) return "#1e1b4b";
  try {
    mctx.drawImage(img, 0, 0, sampleSize, sampleSize,);
    const data = mctx.getImageData(0, 0, sampleSize, sampleSize,).data;
    let bestColor = { r: 30, g: 27, b: 75, sat: 0, };
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b,) / 255, min = Math.min(r, g, b,) / 255;
      const l = (max + min) / 2;
      const sat = max === min
        ? 0
        : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
      if (sat > bestColor.sat && l > 0.2 && l < 0.8) {
        bestColor = { r, g, b, sat, };
      }
    }
    return `rgb(${bestColor.r},${bestColor.g},${bestColor.b})`;
  } catch (_e) {
    return "#1e1b4b";
  }
}

self.onmessage = async (e: MessageEvent,) => {
  const { type, canvas, albums, options, } = e.data;
  if (type !== "generate") return;

  const ctx = (canvas as OffscreenCanvas).getContext("2d", { alpha: false, },);
  if (!ctx) return;

  const { bgMode, applyGrain, showCounts, user, period, } = options as Options;

  try {
    self.postMessage({ type: "status", text: "Acquiring Art...", },);
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

    // --- 2. BACKGROUND ARCHITECTURE ---
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H,);

    if (bgMode === "aura") {
      // Aura: Grid-Mapped Glows (Behind the covers)
      for (let i = 0; i < images.length; i++) {
        if (images[i]) {
          const color = getVibrantColor(images[i],);
          const x = GRID_X[i] + (COVER_SIZE / 2);
          const y = GRID_Y[i] + (COVER_SIZE / 2);
          const grad = ctx.createRadialGradient(x, y, 0, x, y, W * 0.7,);
          grad.addColorStop(0, color,);
          grad.addColorStop(1, "transparent",);
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.globalCompositeOperation = i % 2 === 0 ? "screen" : "soft-light";
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H,);
          ctx.restore();
        }
      }
    } else if (bgMode === "chromatic") {
      ctx.save();
      for (let i = 0; i < images.length; i++) {
        if (images[i]) {
          const col = i % 3, row = Math.floor(i / 3,);
          ctx.save();
          ctx.filter = "blur(180px) saturate(2.0)";
          ctx.globalAlpha = 0.5;
          ctx.drawImage(
            images[i]!,
            (col * W / 3) - 150,
            (row * H / 3) - 150,
            W / 2,
            H / 2,
          );
          ctx.restore();
        }
      }
      ctx.restore();
    } else if (bgMode === "velvet") {
      const color = getVibrantColor(images[0] || null,);
      const grad = ctx.createLinearGradient(0, 0, 0, H,);
      grad.addColorStop(0, color,);
      grad.addColorStop(0.6, "#09090b",);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H,);
    } else if (bgMode === "silver") {
      const grad = ctx.createLinearGradient(0, 0, W, H,);
      grad.addColorStop(0, "#121214",);
      grad.addColorStop(0.5, "#09090b",);
      grad.addColorStop(1, "#1c1c1f",);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H,);
    }

    if (bgMode !== "dark") {
      const vig = ctx.createRadialGradient(
        W / 2,
        H / 2,
        W / 4,
        W / 2,
        H / 2,
        W,
      );
      vig.addColorStop(0, "transparent",);
      vig.addColorStop(1, "rgba(0,0,0,0.7)",);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H,);
    }

    // --- 3. THE GRID ---
    ctx.globalCompositeOperation = "source-over";
    self.postMessage({ type: "status", text: "Balancing Layout...", },);
    for (let i = 0; i < albums.length; i++) {
      const x = GRID_X[i], y = GRID_Y[i];
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 6;
      ctx.save();
      drawRoundedRect(ctx, x, y, COVER_SIZE, COVER_SIZE, CORNER_RADIUS,);
      ctx.clip();
      if (images[i]) ctx.drawImage(images[i]!, x, y, COVER_SIZE, COVER_SIZE,);
      else {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(x, y, COVER_SIZE, COVER_SIZE,);
      }
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x, y, COVER_SIZE, COVER_SIZE, CORNER_RADIUS,);
      ctx.stroke();
    }

    // --- 4. THE LIST ---
    ctx.textBaseline = "middle";
    for (let i = 0; i < albums.length; i++) {
      const y = LIST_BASE_Y + (i * LIST_ROW_HEIGHT);
      const name = (albums[i].name || "Unknown").toUpperCase();
      const artist = (albums[i].artist || "Unknown").toUpperCase();

      let countWidth = 0;
      if (showCounts) {
        const countText = `${albums[i].count}`;
        ctx.font = `bold 16px ${FONT_MONO}`; // Monospace for data
        countWidth = ctx.measureText(countText,).width;
        const pW = countWidth + 24, pH = 32;
        ctx.save();
        ctx.translate(W - MARGIN - pW, y - (pH / 2),);
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        drawRoundedRect(ctx, 0, 0, pW, pH, 16,);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        drawRoundedRect(ctx, 0, 0, pW, pH, 16,);
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(countText, pW / 2, pH / 2,);
        ctx.restore();
        countWidth = pW;
      }

      // Prefix (Monospace for perfect alignment)
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `bold 24px ${FONT_MONO}`;
      const prefix = `${i + 1}. `;
      ctx.fillText(prefix, MARGIN, y,);

      // Name (Sans stack for legibility)
      const prefixWidth = ctx.measureText(prefix,).width;
      ctx.fillStyle = "#f4f4f5";
      ctx.font = `900 24px ${FONT_SANS}`;
      const avail = W - (MARGIN * 2) - prefixWidth
        - (showCounts ? countWidth + 30 : 0);
      let dsp = name;
      if (ctx.measureText(dsp,).width > avail) {
        while (ctx.measureText(dsp + "...",).width > avail && dsp.length > 0) {
          dsp = dsp.slice(0, -1,);
        }
        dsp += "...";
      }
      ctx.fillText(dsp, MARGIN + prefixWidth, y,);

      // Artist (Sans stack)
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `500 18px ${FONT_SANS}`;
      ctx.fillText(
        artist.substring(0, 60,).toUpperCase(),
        MARGIN + prefixWidth,
        y + 28,
      );
    }

    // --- 5. NOISE ENGINE ---
    if (applyGrain) {
      const t = 128,
        tile = new OffscreenCanvas(t, t,),
        tctx = tile.getContext("2d",);
      if (tctx) {
        const id = tctx.createImageData(t, t,);
        for (let i = 0; i < id.data.length; i += 4) {
          const v = Math.random() * 255;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
          id.data[i + 3] = 12;
        }
        tctx.putImageData(id, 0, 0,);
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = ctx.createPattern(tile, "repeat",)!;
        ctx.fillRect(0, 0, W, H,);
        ctx.restore();
      }
    }

    // --- 6. BRANDING ---
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.textAlign = "center";
    ctx.font = `bold 16px ${FONT_MONO}`;
    ctx.letterSpacing = "8px";
    ctx.fillText(
      `TOP ALBUMS • ${period.replace("_", " ",)} • ${user}`.toUpperCase(),
      W / 2,
      H - 100,
    );
    ctx.letterSpacing = "2px";
    ctx.fillText("EGE.CELIKCI.ME", W / 2, H - 72,);

    const blob = await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    },);
    self.postMessage({ type: "done", blob, },);
  } catch (err: unknown) {
    self.postMessage({ type: "error", message: String(err,), },);
  }
};
