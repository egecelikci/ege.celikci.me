import { Page } from "lume/core/file.ts";
import sharp from "sharp";
import type { TypstEngine } from "typst";

export interface TypstOgOptions {
  layout?: string;
}

export default function typstOg({
  layout = "/_includes/layouts/og.typ",
}: TypstOgOptions = {}) {
  return (site: Lume.Site) => {
    let engine: TypstEngine | undefined;

    site.hooks.typst?.((e) => {
      engine = e;
    });

    const templateCache = new Map<string, string>();
    async function getTemplate(path: string): Promise<string> {
      let src = templateCache.get(path);
      if (src === undefined) {
        src = await Deno.readTextFile(site.src(path));
        templateCache.set(path, src);
      }
      return src;
    }

    function escapeTypstStr(str: string): string {
      return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(
        /\n/g,
        " ",
      );
    }

    async function processPage(page: Lume.Page) {
      if (page.data.openGraphLayout === false) return;

      const template = typeof page.data.openGraphLayout === "string"
        ? page.data.openGraphLayout
        : layout;

      try {
        const typstSource = await getTemplate(template);

        let title = page.data.title ? String(page.data.title) : "";
        let desc = page.data.description ? String(page.data.description) : "";

        if (!title) {
          const dateStr = page.data.date instanceof Date
            ? page.data.date.toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
            : "";
          title = `${dateStr}`;

          if (!desc && typeof page.data.content === "string") {
            desc = page.data.content.replace(/<[^>]*>?/gm, "").trim();
          }
        }

        let imgUrl = page.data.image ?? page.data.coverImage ??
          page.data.images?.[0]?.src;

        if (!imgUrl && page.document) {
          const firstImg = page.document.querySelector(
            "[data-og-image], .e-content img",
          );
          imgUrl = firstImg?.getAttribute("src") ??
            firstImg?.getAttribute("data-src") ?? undefined;
        }

        let finalImage = "none";
        if (typeof imgUrl === "string" && imgUrl.length > 0) {
          const isRemote = /^([a-z]+:)?\/\//i.test(imgUrl) ||
            imgUrl.startsWith("data:");
          if (!isRemote) {
            const localPath = imgUrl.startsWith("/") ? imgUrl : `/${imgUrl}`;
            finalImage = `"${localPath}"`;
          }
        }

        // --- EXACT MATHEMATICAL LAYOUT CAPACITY ---
        const hasImage = finalImage !== "none";

        const textWidth = hasImage ? 648 : 1072;
        const titleFontSize = hasImage ? 56 : 72;
        const descFontSize = hasImage ? 32 : 36;

        // DM Mono character width ratio is ~0.58.
        const titleCPL = Math.floor(textWidth / (titleFontSize * 0.58));
        const descCPL = Math.floor(textWidth / (descFontSize * 0.58));

        // Title capacity (Cap title at 3 visual lines to save space)
        const estimatedTitleLines = Math.max(
          1,
          Math.ceil(title.length / titleCPL),
        );
        const finalTitleLines = Math.min(estimatedTitleLines, 3);

        if (title.length > titleCPL * 3) {
          title = title.substring(0, (titleCPL * 3) - 2).trimEnd() + "…";
        }

        // Title Height Formula: lines * fontSize + (lines - 1) * leading(0.6em)
        const titleHeight = (finalTitleLines * titleFontSize) +
          (Math.max(0, finalTitleLines - 1) * (titleFontSize * 0.6));

        const verticalGap = hasImage ? 40 : 48;

        // Set mathematical limit slightly smaller than the physical 460pt box.
        // This guarantees a ~10pt buffer at the bottom so descenders ('y', 'p') are never cut.
        const maxMathHeight = 450;

        const availableDescHeight = maxMathHeight - titleHeight - verticalGap;

        let maxDescLines = 0;
        if (availableDescHeight >= descFontSize) {
          // Desc lines Formula: Divide by 1.6 to account for 0.6em leading
          maxDescLines = Math.floor(availableDescHeight / (descFontSize * 1.6));
        }

        // Add a 5% bonus to capacity to account for word-wrap packing differences
        const descCharLimit = Math.max(
          0,
          Math.floor(maxDescLines * descCPL * 1.05),
        );

        // Apply dynamic limit and Ellipsis
        if (desc.length > descCharLimit) {
          if (descCharLimit > 3) {
            desc = desc.substring(0, descCharLimit - 2).trimEnd() + "…";
          } else {
            desc = "";
          }
        }
        // -------------------------------------------

        const injectedSource = `
#let og-title = "${escapeTypstStr(title)}"
#let og-description = "${escapeTypstStr(desc)}"
#let og-image = ${finalImage}
\n` + typstSource;

        const svg = await engine!.render(injectedSource, {
          url: "/og.svg",
          type: "svg",
        });

        const svgText = typeof svg === "string"
          ? svg
          : new TextDecoder().decode(svg as Uint8Array);

        if (!svgText.trim().startsWith("<svg")) {
          console.error(`[typst-og] Expected SVG output for ${page.data.url}`);
          return;
        }

        const png = new Uint8Array(
          await sharp(new TextEncoder().encode(svgText))
            .resize({ width: 1200 })
            .png()
            .toBuffer(),
        );

        const urlPath = page.data.url === "/"
          ? "/index"
          : page.data.url.replace(/\/$/, "");
        const output = `/assets/images/og${urlPath}.png`;

        site.pages.push(Page.create({ url: output, content: png }));

        page.data.metas ??= {};
        page.data.metas.image = site.url(output, true);
      } catch (error) {
        console.error(
          `[typst-og] Failed to generate for ${page.data.url}:`,
          error,
        );
      }
    }

    site.process([".html"], async (pages) => {
      if (!engine) {
        console.error("[typst-og] Typst engine not found.");
        return;
      }
      await Promise.all(pages.map(processPage));
    });
  };
}
