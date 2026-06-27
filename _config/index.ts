/**
 * _config/index.ts
 * Main configuration orchestrator.
 */

Deno.env.set("TZ", "Europe/Istanbul");

import "./types.ts";
import attributes from "lume/plugins/attributes.ts";
import checkUrls from "lume/plugins/check_urls.ts";
import date from "lume/plugins/date.ts";
import extractDate from "lume/plugins/extract_date.ts";
import favicon from "lume/plugins/favicon.ts";
import gitDate from "https://cdn.jsdelivr.net/gh/lumeland/experimental-plugins@6f4b6eb74af9524b49170c858727319dd1c49780/git_date/mod.ts";
import gitInfo from "https://cdn.jsdelivr.net/gh/lumeland/experimental-plugins@6f4b6eb74af9524b49170c858727319dd1c49780/git_info/mod.ts";
import googleFonts from "lume/plugins/google_fonts.ts";
import imageSize from "lume/plugins/image_size.ts";
import jsonLd from "lume/plugins/json_ld.ts";
import metas from "lume/plugins/metas.ts";
import multilanguage from "lume/plugins/multilanguage.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import nav from "lume/plugins/nav.ts";
import pagefind from "lume/plugins/pagefind.ts";
import robots from "lume/plugins/robots.ts";
import seo from "lume/plugins/seo.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugifyPlugin from "lume/plugins/slugify_urls.ts";
import validateHTML from "lume/plugins/validate_html.ts";
import typst from "https://codeberg.org/egecelikci/experimental-plugins/raw/commit/473516014232336fc8aa820691bec0cb41fd4f2e/typst/mod.ts";
import assets from "./assets.ts";
import feeds from "./feeds.ts";
import filters from "./filters.ts";
import markdown from "./markdown.ts";
import { jsonLd as jsonLdData } from "./metadata.ts";

export default function () {
  const isDev = Deno.env.get("MODE") !== "production";

  return (site: Lume.Site) => {
    site
      .use(attributes())
      .use(imageSize())
      .use(slugifyPlugin())
      .use(metas())
      .use(multilanguage({
        languages: ["en", "tr"],
        defaultLanguage: "en",
      }))
      .use(extractDate())
      .use(date({
        formats: { URL: "yyyyMMddHHmmss" },
      }))
      .use(sitemap())
      .use(robots({
        rules: [
          {
            userAgent: "*",
            disallow: "/build.txt",
            contentSignal: "none",
          },
        ],
      }))
      .use(nav())
      .use(jsonLd())
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
      }))
      .use(pagefind({
        outputPath: "/pagefind",
        indexing: {
          rootSelector: "html",
          verbose: false,
        },
        ui: {
          containerId: "#search",
          showImages: false,
          showEmptyFilters: true,
          resetStyles: true,
        },
      }))
      // Modularized configs
      .use(googleFonts({
        fonts:
          "https://fonts.google.com/share?selection.family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500|DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000",
        fontsFolder: "/assets/fonts",
        cssFile: "/assets/styles/main.css",
        subsets: ["latin", "latin-ext"],
      }))
      .use(assets())
      .use(feeds())
      .use(typst({
        fonts: ["/assets/fonts"],
      }))
      .use(filters())
      .use(markdown())
      .use(gitDate())
      .use(gitInfo());

    // Production-only optimizations and checks
    if (!isDev) {
      site
        .use(minifyHTML())
        .use(checkUrls())
        .use(seo())
        .use(validateHTML());
    }

    // Global default for all Markdown files: Vento then Markdown
    site.data("templateEngine", ["vto", "md"], ".md");
    site.data("templateEngine", "typ", ".typ");
    site.data("jsonLd", jsonLdData);
  };
}
