/**
 * _config/index.ts
 * Main configuration orchestrator.
 */

import "./types.ts";
import attributes from "lume/plugins/attributes.ts";
import date from "lume/plugins/date.ts";
import extractDate from "lume/plugins/extract_date.ts";
import favicon from "lume/plugins/favicon.ts";
import metas from "lume/plugins/metas.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import ogImages from "lume/plugins/og_images.ts";
import pagefind from "lume/plugins/pagefind.ts";
import paginate from "lume/plugins/paginate.ts";
import robots from "lume/plugins/robots.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugifyPlugin from "lume/plugins/slugify_urls.ts";

import assets from "./assets.ts";
import feeds from "./feeds.ts";
import filters from "./filters.ts";
import markdown from "./markdown.ts";

export default function() {
  return (site: Lume.Site,) => {
    site
      .use(attributes(),)
      .use(slugifyPlugin(),)
      .use(ogImages(),)
      .use(metas(),)
      .use(date({ formats: { "URL": "yyyyMMddHHmmss", }, },),)
      .use(extractDate(),)
      .use(paginate(),)
      .use(sitemap(),)
      .use(robots({ rules: [{ userAgent: "*", disallow: "/build.txt", },], },),)
      .use(minifyHTML(),)
      .use(favicon({
        input: "/assets/images/favicon/favicon.svg",
        favicons: [
          {
            url: "/assets/images/favicon/favicon.ico",
            size: [32],
            rel: "icon",
            format: "ico",
          },
          {
            url: "/assets/images/favicon/apple-touch-icon.png",
            size: [180],
            rel: "apple-touch-icon",
            format: "png",
          },
          {
            url: "/assets/images/favicon/android-chrome-192x192.png",
            size: [192],
            rel: "icon",
            format: "png",
          },
          {
            url: "/assets/images/favicon/android-chrome-512x512.png",
            size: [512],
            rel: "icon",
            format: "png",
          },
        ],
      },),)
      .use(pagefind({
        outputPath: "/pagefind",
        ui: {
          containerId: "#search",
          showImages: false,
          showEmptyFilters: true,
        },
      },),)
      // Modularized configs
      .use(assets(),)
      .use(feeds(),)
      .use(filters(),)
      .use(markdown(),);

    // Global default for all Markdown files: Vento then Markdown
    site.data("templateEngine", ["vto", "md",], ".md",);
  };
}
