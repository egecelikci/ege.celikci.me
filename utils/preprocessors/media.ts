import { remarkParse, unified } from "lume/deps/remark.ts";

export interface PostImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

interface MdastNode {
  type: string;
  url?: string;
  alt?: string;
  value?: string;
  children?: MdastNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

interface MdastRoot extends MdastNode {
  type: "root";
  children: MdastNode[];
}

const IMG_REGEX_SRC =
  /!\[[^\]]*\]\(([^)\s=]+)(?:\s+=(\d+)?x(\d+)?)?(?:\s+"[^"]*")?\)/;

const parser = unified.unified().use(remarkParse);

function walk(node: MdastNode, visit: (node: MdastNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
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
  const regex = new RegExp(IMG_REGEX_SRC.source, "y");
  regex.lastIndex = start;
  return regex.exec(content);
}

export default function () {
  return (site: Lume.Site) => {
    site.preprocess([".md"], (pages) => {
      for (const page of pages) {
        const pageUrl = page.data.url as string;
        if (!pageUrl) continue;

        const isNote = page.src.path.startsWith("/notes/") ||
          page.data.type === "note";
        const isPost = page.src.path.startsWith("/blog/") ||
          page.data.type === "post";

        if (!isNote && !isPost) continue;

        const content = page.data.content;
        if (typeof content !== "string" || content.length === 0) continue;

        const tree = parser.parse(content) as MdastRoot;

        const images: PostImage[] = [];
        const imageRanges: Array<[number, number]> = [];

        walk(tree, (node) => {
          if (node.type !== "image" || !node.url) return;
          if (!isSupportedSrc(node.url)) return;
          images.push({
            src: node.url,
            alt: node.alt ?? "",
          });

          const start = node.position?.start.offset;
          const end = node.position?.end.offset;
          if (typeof start === "number" && typeof end === "number") {
            imageRanges.push([start, end]);
          }
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
          const alreadyParsed = imageRanges.some(
            ([as, ae]) => start < ae && as < end,
          );

          if (!alreadyParsed) {
            images.push({
              alt: match[0].slice(2, match[0].indexOf("]")),
              src,
              width: match[2] ? parseInt(match[2], 10) : undefined,
              height: match[3] ? parseInt(match[3], 10) : undefined,
            });
            imageRanges.push([start, end]);
          }

          i = end;
        }

        const stripped = isNote && imageRanges.length > 0
          ? (() => {
            let result = content;
            for (
              const [start, end] of imageRanges.sort((a, b) => b[0] - a[0])
            ) {
              result = result.slice(0, start) + result.slice(end);
            }
            return result;
          })()
          : content;

        if (isNote) {
          page.data.content = stripped;
        }

        if (images.length === 0) continue;

        page.data.images = images;
        const cover = images[0];

        if (!page.data.coverImage) {
          page.data.coverImage = cover.src;
          page.data.coverImageAlt = cover.alt;
        }
        if (!page.data.metaImage && page.data.coverImage) {
          page.data.metaImage = page.data.coverImage;
        }

        if (isNote) {
          if (!page.data.description && cover.alt) {
            page.data.description = cover.alt;
          }
          if (!page.data.description || page.data.description.length < 10) {
            const cleanTree = parser.parse(stripped) as MdastRoot;
            const teaser = cleanTree.children.map(nodeText).join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (teaser) {
              page.data.description = teaser.length > 200
                ? teaser.substring(0, 197) + "..."
                : teaser;
            }
          }
        }
      }
    });
  };
}
