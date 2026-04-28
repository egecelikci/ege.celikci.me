/**
 * _config/markdown.ts
 * Remark/Rehype/Shiki configuration.
 */

import rehypeShiki from "@shikijs/rehype";
import remark, { Options as RemarkOptions } from "lume/plugins/remark.ts";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import remarkToc from "remark-toc";

import {
  alistralLangs,
  loadAlistralTheme,
  transformerFilename,
} from "../src/_includes/alistral-shiki.ts";

export default function (options: RemarkOptions = {}) {
  return async (site: Lume.Site) => {
    const lotusTheme = await loadAlistralTheme("kanagawa-lotus");
    const waveTheme = await loadAlistralTheme("kanagawa-wave");

    site.use(remark({
      ...options,
      remarkPlugins: [
        [remarkToc, { tight: true }],
        remarkGfm,
        remarkSmartypants,
        ...(options.remarkPlugins || []),
      ],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: "prepend",
          content: { type: "text", value: "#" },
          properties: {
            className: ["heading-anchor"],
            ariaHidden: true,
            tabIndex: -1,
          },
        }],
        [rehypeShiki, {
          langs: [
            "bash",
            "fish",
            "javascript",
            "jinja",
            "json",
            "markdown",
            "typescript",
            ...alistralLangs,
          ],
          themes: { light: lotusTheme, dark: waveTheme },
          defaultColor: "light-dark()",
          transformers: [transformerFilename()],
        }],
        ...(options.rehypePlugins || []),
      ],
    }));
  };
}
