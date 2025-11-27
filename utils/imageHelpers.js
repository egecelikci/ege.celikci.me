import Image from "@11ty/eleventy-img";
import path from "path";

// Configuration for where Eleventy should output the processed images
// Adjust "dist" if your output folder is named differently (e.g., "_site")
const IMAGE_OUTPUT_DIR = "./dist/img/";
const IMAGE_URL_PATH = "/img/";

async function galleryImage(src, alt, sizes = "100vw") {
  if (!src) {
    throw new Error("galleryImage: Missing 'src' attribute.");
  }

  // 1. Resolve the path.
  // If src starts with "/", resolve it relative to the project root.
  // Otherwise, eleventy-img handles relative paths from CWD.
  let fileSrc = src;
  if (src.startsWith("/")) {
    fileSrc = path.join(process.cwd(), src);
  }

  // 2. Configure image processing
  let metadata = await Image(fileSrc, {
    // Widths: Generate a small one for loading, a few mid-sizes, and 'auto' for original
    widths: [600, 900, 1200, "auto"],
    formats: ["webp", "jpeg"],
    urlPath: IMAGE_URL_PATH,
    outputDir: IMAGE_OUTPUT_DIR,
    // Optional: Add custom filename format here if you want to match Vite's hashing style
    // but default hashing is usually sufficient.
  });

  // 3. Get the "High Res" image data for PhotoSwipe
  // We use the largest JPEG generated as the 'full' image for the lightbox
  let highRes = metadata.jpeg[metadata.jpeg.length - 1];

  // 4. Generate standard responsive attributes for the thumbnail
  let imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };

  // 5. Generate the HTML for the thumbnail
  let thumbnailHtml = Image.generateHTML(metadata, imageAttributes);

  // 6. Wrap it in the anchor tag with PhotoSwipe data attributes
  return `
    <a href="${highRes.url}" 
       data-pswp-width="${highRes.width}" 
       data-pswp-height="${highRes.height}" 
       target="_blank"
       class="gallery-item">
      ${thumbnailHtml}
    </a>
  `;
}

export default {
  galleryImage,
};
