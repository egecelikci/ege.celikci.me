import { Buffer, } from "node:buffer";
import sharp from "sharp";

/**
 * Saves a resized, color DITHERED version of the cover.
 * OPTIMIZATION: High compression, low color count.
 */
export async function saveColorVersion(
  inputPath: string | Buffer,
  outputPath: string,
) {
  try {
    await sharp(inputPath,)
      .resize(290, 290, { fit: "cover", },)
      .png({
        palette: true,
        colors: 16,
        dither: 1.0,
        effort: 10,
        compressionLevel: 9,
      },)
      .toFile(outputPath,);
  } catch (e: unknown) {
    console.error(
      `[utils/images.ts] Failed to save color cover: ${(e as Error).message}`,
    );
  }
}

/**
 * Process image with Floyd-Steinberg dithering (Transparent Mono)
 * OUTPUT: Transparent PNG (Black Ink + Transparent Background)
 */
export async function ditherWithSharp(
  inputPath: string | Buffer,
  outputPath: string,
) {
  const { data, info, } = await sharp(inputPath,)
    .resize(290, 290, { fit: "cover", },)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true, },);

  const width = info.width;
  const height = info.height;
  const inputPixels = new Uint8Array(data,);

  const outputPixels = new Uint8Array(width * height * 4,);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = inputPixels[idx];
      const newPixel = oldPixel < 128 ? 0 : 255;

      const error = oldPixel - newPixel;
      inputPixels[idx] = newPixel;

      if (x + 1 < width) inputPixels[idx + 1] += (error * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) inputPixels[idx + width - 1] += (error * 3) / 16;
        inputPixels[idx + width] += (error * 5) / 16;
        if (x + 1 < width) inputPixels[idx + width + 1] += (error * 1) / 16;
      }

      const outIdx = idx * 4;
      if (newPixel === 0) {
        outputPixels[outIdx] = 0;
        outputPixels[outIdx + 1] = 0;
        outputPixels[outIdx + 2] = 0;
        outputPixels[outIdx + 3] = 255;
      } else {
        outputPixels[outIdx] = 0;
        outputPixels[outIdx + 1] = 0;
        outputPixels[outIdx + 2] = 0;
        outputPixels[outIdx + 3] = 0;
      }
    }
  }

  await sharp(Buffer.from(outputPixels,), {
    raw: {
      width: width,
      height: height,
      channels: 4,
    },
  },)
    .png({
      palette: true,
      colors: 2,
      effort: 10,
    },)
    .toFile(outputPath,);
}