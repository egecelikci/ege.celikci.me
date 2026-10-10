import remark from "lume/plugins/remark.ts";
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

export const remarkPlugin = () => {
  return (site: Lume.Site) => {
    site.use(remark({
      remarkPlugins: [
        [remarkToc, {
          heading: "([iİIı]ç[iİIı]ndek[iİIı]ler|contents|table of contents)",
          tight: true,
        }],
        remarkGfm,
        remarkSmartypants,
      ],
      rehypePlugins: [
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: "wrap",
          properties: {
            className: ["heading-anchor"],
          },
        }],
        [rehypeShiki, shikiConfig],
      ],
    }));
  };
};

export default remarkPlugin;
