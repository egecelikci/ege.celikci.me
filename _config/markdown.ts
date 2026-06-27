import remark, { Options as RemarkOptions } from "lume/plugins/remark.ts";
import rehypeShiki from "@shikijs/rehype";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkSmartypants from "remark-smartypants";
import remarkToc from "remark-toc";

const shikiConfig = {
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
};

export const remarkPlugin = (options: RemarkOptions = {}) => {
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
          content: {
            type: "element",
            tagName: "span",
            properties: { className: ["heading-anchor"] },
            children: [{ type: "text", value: "#" }],
          },
          properties: {
            ariaHidden: true,
            tabIndex: -1,
          },
        }],
        [rehypeShiki, shikiConfig],
        ...(options.rehypePlugins || []),
      ],
    }));
  };
};

export default remarkPlugin;
