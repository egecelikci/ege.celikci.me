import "lume/types.ts";
import { merge, } from "lume/core/utils/object.ts";

// 1. Lume Plugin Imports
import date, { Options as DateOptions, } from "lume/plugins/date.ts";
import esbuild, { Options as EsbuildOptions, } from "lume/plugins/esbuild.ts";
import favicon, { Options as FaviconOptions, } from "lume/plugins/favicon.ts";
import feed, { Options as FeedOptions, } from "lume/plugins/feed.ts";
import icons from "lume/plugins/icons.ts";
import inline from "lume/plugins/inline.ts";
import metas from "lume/plugins/metas.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import nav from "lume/plugins/nav.ts";
import ogImages from "lume/plugins/og_images.ts";
import pagefind, {
  Options as PagefindOptions,
} from "lume/plugins/pagefind.ts";
import paginate from "lume/plugins/paginate.ts";
import picture from "lume/plugins/picture.ts";
import postcss from "lume/plugins/postcss.ts";
import remark, { Options as RemarkOptions, } from "lume/plugins/remark.ts";
import robots from "lume/plugins/robots.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugify, {
  Options as SlugifyOptions,
} from "lume/plugins/slugify_urls.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import transformImages from "lume/plugins/transform_images.ts";

import rehypeShiki from "npm:@shikijs/rehype@^3.19.0";
import rehypeAutolinkHeadings from "npm:rehype-autolink-headings@^7.1.0";
import rehypeSlug from "npm:rehype-slug@^6.0.0";
import remarkGfm from "npm:remark-gfm@^4.0.1";
import remarkSmartypants from "npm:remark-smartypants@^3.0.2";
import remarkToc from "npm:remark-toc@^9.0.0";
import remarkWikiLink from "npm:remark-wiki-link@^2.0.1";

import siteData from "./src/_data/site.ts";

import {
  alistralLangs,
  loadAlistralTheme,
  transformerFilename,
} from "./src/_includes/alistral-shiki.ts";
import lightboxWrapper from "./src/_plugins/lightbox_wrapper.ts";

export interface Options {
  date?: Partial<DateOptions>;
  esbuild?: Partial<EsbuildOptions>;
  favicon?: Partial<FaviconOptions>;
  feed?: Partial<FeedOptions>;
  remark?: Partial<RemarkOptions>;
  slugify?: Partial<SlugifyOptions>;
  pagefind?: Partial<PagefindOptions>;
}

// 4. Move all configurations to defaults
export const defaults: Options = {
  date: {
    timezone: "Europe/Istanbul",
  },
  favicon: {
    input: "assets/images/favicon/favicon.svg",
    favicons: [
      {
        url: "/assets/images/favicon/android-chrome-192x192.png",
        size: [192,],
        rel: "android-chrome",
        format: "png",
      },
      {
        url: "/assets/images/favicon/apple-touch-icon.png",
        size: [180,],
        rel: "apple-touch-icon",
        format: "png",
      },
      {
        url: "/assets/images/favicon/favicon-32x32.png",
        size: [32,],
        rel: "icon",
        format: "png",
      },
      {
        url: "/assets/images/favicon/favicon-16x16.png",
        size: [16,],
        rel: "icon",
        format: "png",
      },
      {
        url: "/assets/images/favicon/favicon.ico",
        size: [32,],
        rel: "shortcut icon",
        format: "ico",
      },
    ],
  },
  esbuild: {
    extensions: [".ts",],
    options: {
      plugins: [],
      bundle: true,
      format: "esm",
      splitting: true,
      minify: true,
      target: "esnext",
      logLevel: "info",
      chunkNames: "assets/scripts/chunks/[name]-[hash]",
      define: {
        "process.env.MODE": JSON.stringify(
          Deno.env.get("MODE",) || "development",
        ),
      },
    },
  },
  feed: {
    info: {
      title: siteData.host,
      description: siteData.description,
    },
    items: {
      title: "=title",
      description: "=excerpt",
    },
    limit: 0,
  },
  pagefind: {
    outputPath: "/pagefind",
    ui: {
      containerId: "#wiki-search",
      showImages: false,
      showEmptyFilters: true,
    },
  },
};

export default function(userOptions?: Options,) {
  const options = merge(defaults, userOptions,);

  return async (site: Lume.Site,) => {
    const lotusTheme = await loadAlistralTheme("kanagawa-lotus",);
    const waveTheme = await loadAlistralTheme("kanagawa-wave",);

    site
      .use(esbuild(options.esbuild,),)
      .use(tailwindcss(),)
      .use(postcss(),)
      .use(slugify(options.slugify,),)
      .use(ogImages(),)
      .use(picture(),)
      .use(transformImages(),)
      .use(favicon(options.favicon,),)
      .use(metas(),)
      .use(date(options.date,),)
      .use(nav(),)
      .use(pagefind(options.pagefind,),)
      .use(paginate(),)
      .use(icons(),)
      .use(inline(),)
      .use(remark({
        ...options.remark,
        remarkPlugins: [
          [remarkToc, {
            tight: true,
          },],
          remarkGfm,
          remarkSmartypants,
          [remarkWikiLink, {
            aliasDivider: "|",
            pageResolver: (
              name: string,
            ) => [name.replace(/ /g, "-",).toLowerCase(),],
            hrefTemplate: (permalink: string,) => `/wiki/${permalink}/`,
          },],
          ...(options.remark?.remarkPlugins || []),
        ],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, {
            behavior: "prepend",
            content: { type: "text", value: "#", },
            properties: {
              className: ["heading-anchor",],
              ariaHidden: true,
              tabIndex: -1,
            },
          },],
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
            themes: { light: lotusTheme, dark: waveTheme, },
            defaultColor: "light-dark()",
            transformers: [transformerFilename(),],
          },],
          ...(options.remark?.rehypePlugins || []),
        ],
      },),)
      .use(lightboxWrapper(),)
      .use(sitemap(),)
      .use(robots({
        rules: [{ userAgent: "*", disallow: "/build.txt", },],
      },),)
      .use(feed({
        ...options.feed,
        output: ["feed.xml", "feed.json",],
        query: "type=post|note",
      },),)
      .use(feed({
        ...options.feed,
        output: ["notes.xml", "notes.json",],
        query: "type=note",
        info: { ...options.feed?.info, title: `notes | ${siteData.host}`, },
      },),)
      .use(feed({
        ...options.feed,
        output: ["blog.xml", "blog.json",],
        query: "type=post",
        info: { ...options.feed?.info, title: `blog | ${siteData.host}`, },
      },),)
      // ... existing blog feed ...
      .use(feed({
        ...options.feed,
        output: ["wiki.xml", "wiki.json",],
        query: "type=entry",
        sort: "updated=desc",
        info: {
          ...options.feed?.info,
          title: `wiki recent changes | ${siteData.host}`,
          description: "Track the latest updates and edits to the wiki.",
        },
      },),)
      .use(minifyHTML(),)
      .add("assets/scripts/main.ts",)
      .add("assets/styles/main.css",)
      .copy("assets/images",)
      .copy("assets/fonts",)
      .remote(
        "assets/styles/vendor/photoswipe.css",
        "https://unpkg.com/photoswipe/dist/photoswipe.css",
      );
  };
}
