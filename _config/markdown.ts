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

export default function (options: RemarkOptions = {}) {
  return async (site: Lume.Site) => {
    site.use(remark({
      ...options,
      remarkPlugins: [
        [remarkToc, {
          heading: "([iİIı]ç[iİIı]ndek[iİIı]ler|contents|table of contents)",
          tight: true,
        }],
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
          ],
          themes: { light: "kanagawa-lotus", dark: "kanagawa-wave" },
          defaultColor: "light-dark()",
        }],
        ...(options.rehypePlugins || []),
      ],
    }));
  };
}
