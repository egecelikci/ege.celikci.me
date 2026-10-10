import { type MdastNode, parseMarkdown, walk } from "../mdast.ts";

export interface PostImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  spoiler?: Spoiler;
}

/**
 * Spoiler gating a media item behind opt-in reveal.
 */
export interface Spoiler {
  /** Short disclosure shown on the cover, e.g. `"food photography"`. */
  label: string;
  /** Optional hashtag slug rendered with Tag styling, e.g. `"neverslop"`. */
  tag?: string;
  /** Optional lucide icon name for the toggle (default `"eye-off"`). */
  icon?: string;
  /** Optional toggle icon while revealed (default `"eye"`, or `"bot-off"` for `"bot"`). */
  iconAlt?: string;
}

/**
 * Intrinsic pixel dimensions of an image.
 */
export interface ImageDimensions {
  width: number;
  height: number;
}

const dimensionCache = new Map<string, ImageDimensions | null>();

const PROBEABLE_EXT = /\.(jpg|jpeg|png|webp|avif|gif)$/i;

/**
 * Probe the intrinsic dimensions of a local image file.
 *
 * Uses the same header-sniffing reader as Lume's own `image_size` plugin
 * (`lume/deps/image_dimmensions.ts`), so template-time dimensions always
 * agree with the `width`/`height` attributes the pipeline stamps onto the
 * final `<img>`. Only the file header is read; images are never decoded.
 *
 * @param src - Site-absolute image URL path (e.g. `/assets/images/gallery/x.jpg`).
 * @param root - Folder the URL path resolves against; tests point it at fixtures.
 * @returns The intrinsic dimensions, or `undefined` when dimensions are
 * unknowable: remote URLs, non-image paths, path-traversal attempts,
 * missing/unreadable files, and unsupported formats. Never throws.
 */
export async function probeLocalImageSize(
  src: string,
  root = "src",
): Promise<ImageDimensions | undefined> {
  if (!src.startsWith("/")) return undefined;
  const clean = src.split(/[?#]/)[0];
  if (!PROBEABLE_EXT.test(clean)) return undefined;
  if (clean.includes("..") || clean.includes("//") || clean.includes("\\")) {
    return undefined;
  }

  const path = `${root}${clean}`;
  const cached = dimensionCache.get(path);
  if (cached !== undefined) return cached ?? undefined;

  let size: ImageDimensions | undefined;
  try {
    const { imageDimensionsFromStream } = await loadImageDimmensions();
    using file = await Deno.open(path, { read: true });
    const dims = await imageDimensionsFromStream(file.readable);
    if (dims) size = { width: dims.width, height: dims.height };
  } catch {
    size = undefined;
  }
  dimensionCache.set(path, size ?? null);
  return size;
}

/**
 * Fill in missing `width`/`height` for note images.
 *
 * @param images - Images extracted from note Markdown.
 * @param root - Folder image URL paths resolve against.
 * @returns A new array where images lacking dimensions gain probed ones.
 * Explicit `=WxH` author overrides are preserved as-is; unprobable
 * sources are returned untouched. Never throws.
 */
export async function enrichImagesWithDimensions(
  images: PostImage[],
  root = "src",
): Promise<PostImage[]> {
  return await Promise.all(images.map(async (image) => {
    if (image.width && image.height) return image;
    const size = await probeLocalImageSize(image.src, root);
    if (!size) return image;
    return { ...image, width: size.width, height: size.height };
  }));
}

const IMG_REGEX_SRC =
  /!\[[^\]]*\]\(([^)\s=]+)(?:\s+=(\d+)?x(\d+)?)?(?:\s+"[^"]*")?\)/;

/** Single sticky instance; `lastIndex` is set before every `exec`. */
const IMG_REGEX_STICKY = new RegExp(IMG_REGEX_SRC.source, "y");

/** Lazily-loaded dimension reader, memoized across probes. */
type ImageDimmensions = typeof import("lume/deps/image_dimmensions.ts");
let imageDimmensions: ImageDimmensions | undefined;

async function loadImageDimmensions(): Promise<ImageDimmensions> {
  return imageDimmensions ??= await import("lume/deps/image_dimmensions.ts");
}

/**
 * Images extracted from note Markdown plus the source ranges they
 * occupy, so callers can strip the markup from the rendered body.
 */
export interface ExtractedMedia {
  images: PostImage[];
  ranges: Array<[number, number]>;
}

/**
 * Extract image references from note Markdown.
 *
 * Standard `![alt](src)` images are found via the remark AST; the
 * `![alt](src =WxH)` author-size syntax remark cannot parse is caught
 * by a sticky-regex fallback pass. A `{spoiler: label}` suffix directly after
 * an image marks it warned, e.g. `![ramen](/r.jpg){spoiler: food photography}`.
 * Each source offset is claimed once, so one markup image never yields
 * two entries.
 *
 * @param content - Raw note Markdown source.
 * @returns The extracted images in document order and their source ranges
 * (spoiler suffixes included, so stripping removes them from the body).
 */
export function extractMediaImages(content: string): ExtractedMedia {
  const tree = parseMarkdown(content);
  const entries: Array<{
    image: PostImage;
    start: number | null;
    range: [number, number] | null;
  }> = [];
  if (!tree) return { images: [], ranges: [] };

  walk(tree, (node) => {
    if (node.type !== "image" || !node.url) return;
    if (!isSupportedSrc(node.url)) return;

    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    entries.push({
      image: { src: node.url, alt: node.alt ?? "" },
      start: typeof start === "number" ? start : null,
      range: typeof start === "number" && typeof end === "number"
        ? [start, end]
        : null,
    });
  });

  for (let i = 0; i < content.length;) {
    const match = matchAt(content, i);
    if (!match || match.index === undefined) {
      i++;
      continue;
    }

    const src = match[1];
    const start = match.index;
    if (!isSupportedSrc(src)) {
      i = start + match[0].length;
      continue;
    }
    const end = start + match[0].length;
    const alreadyParsed = entries.some(({ range }) =>
      range !== null && start < range[1] && range[0] < end
    );

    if (!alreadyParsed) {
      entries.push({
        image: {
          alt: match[0].slice(2, match[0].indexOf("]")),
          src,
          width: match[2] ? parseInt(match[2], 10) : undefined,
          height: match[3] ? parseInt(match[3], 10) : undefined,
        },
        start,
        range: [start, end],
      });
    }

    i = end;
  }

  for (const entry of entries) {
    if (entry.range === null) continue;
    const suffix = content.slice(entry.range[1]).match(
      /^[ \t]*\{spoiler:[ \t]*([^}\n]+?)[ \t]*\}/,
    );
    if (!suffix) continue;
    entry.image.spoiler = { label: suffix[1].trim() };
    entry.range[1] += suffix[0].length;
  }

  entries.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
  return {
    images: entries.map((e) => e.image),
    ranges: entries.flatMap((e) => e.range === null ? [] : [e.range]),
  };
}

/**
 * Remove extracted image markup from note Markdown source.
 *
 * @param content - Raw note Markdown source.
 * @param ranges - Source ranges from {@link extractMediaImages}.
 * @returns The source with every ranged span excised. The input array
 * is left unmodified.
 */
export function stripMediaRanges(
  content: string,
  ranges: Array<[number, number]>,
): string {
  let result = content;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

function nodeText(node: MdastNode): string {
  if (node.type === "html") return "";
  if (node.value) return node.value;
  return (node.children ?? []).map(nodeText).join("");
}
function isSupportedSrc(src: string): boolean {
  return src.startsWith("/") || src.startsWith("http") ||
    /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(src);
}

function matchAt(content: string, start: number) {
  IMG_REGEX_STICKY.lastIndex = start;
  return IMG_REGEX_STICKY.exec(content);
}

export default function () {
  return (site: Lume.Site) => {
    site.addEventListener("beforeUpdate", ({ files }) => {
      if ([...files].some((file) => PROBEABLE_EXT.test(file))) {
        dimensionCache.clear();
      }
    });

    site.preprocess([".md"], async (pages) => {
      for (const page of pages) {
        if (!page.data.url) continue;

        const isNote = page.src.path.startsWith("/notes/") ||
          page.data.type === "note";

        if (!isNote) continue;

        const content = page.data.content;
        if (typeof content !== "string" || content.length === 0) continue;

        const { images, ranges } = extractMediaImages(content);
        const stripped = ranges.length > 0
          ? stripMediaRanges(content, ranges)
          : content;
        page.data.content = stripped;

        if (images.length === 0) continue;

        page.data.images = await enrichImagesWithDimensions(images);
        const cover = images[0];

        if (!page.data.coverImage) {
          page.data.coverImage = cover.src;
          page.data.coverImageAlt = cover.alt;
        }
        if (!page.data.metaImage && page.data.coverImage) {
          page.data.metaImage = page.data.coverImage;
        }

        if (!page.data.description && cover.alt) {
          page.data.description = cover.alt;
        }
        if (!page.data.description || page.data.description.length < 10) {
          const cleanTree = parseMarkdown(stripped);
          const teaser = (cleanTree?.children.map(nodeText).join(" ") ?? "")
            .replace(/\s+/g, " ")
            .trim();

          if (teaser) {
            page.data.description = teaser.length > 200
              ? teaser.substring(0, 197) + "…"
              : teaser;
          }
        }
      }
    });
  };
}
