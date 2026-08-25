import { Page } from "lume/core/file.ts";
import type { TypstEngine } from "typst";

export interface TypstOgOptions {
  layout?: string;
}

export default function typstOg({
  layout = "/_includes/layouts/og.typ",
}: TypstOgOptions = {}) {
  return (site: Lume.Site) => {
    const isDev = Deno.env.get("MODE") !== "production";
    if (isDev) return;

    let engine: TypstEngine | undefined;

    site.hooks.typst?.((e: TypstEngine) => {
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

    async function processPage(page: Lume.Page<Lume.GlobalData>) {
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

        let imagePath = "";
        if (typeof imgUrl === "string" && imgUrl.length > 0) {
          const isRemote = /^([a-z]+:)?\/\//i.test(imgUrl) ||
            imgUrl.startsWith("data:");
          if (!isRemote) {
            const local = imgUrl.startsWith("/") ? imgUrl : `/${imgUrl}`;
            try {
              imagePath = site.src(local);
              await Deno.stat(imagePath);
            } catch {
              console.warn(
                `[typst-og] Image not found for ${page.data.url}: ${local}`,
              );
              imagePath = "";
            }
          }
        }

        const svg = engine!.render(typstSource, {
          url: "/og.svg",
          "og-title": title,
          "og-description": desc,
          "og-image-path": imagePath,
        });

        const svgText = typeof svg === "string"
          ? svg
          : new TextDecoder().decode(svg as Uint8Array);

        if (!svgText.trim().startsWith("<svg")) {
          console.error(`[typst-og] Expected SVG output for ${page.data.url}`);
          return;
        }

        const sharp = (await import("sharp")).default;
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
        page.data.metas = {
          ...(page.data.metas || {}),
          image: site.url(output, true),
        };
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
