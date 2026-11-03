/**
 * Main configuration orchestrator.
 */

process.env.TZ = "Europe/Istanbul";

import "./types.ts";

import attributes from "../plugins/attributes.ts";
import checkUrls from "@lumeland/plugin-check-urls";
import date from "@lumeland/plugin-date";
import extractDate from "@lumeland/plugin-extract-date";
import favicon from "@lumeland/plugin-favicon";
import gitDate from "@lumeland/plugin-git-date";
import gitInfo from "@lumeland/plugin-git-info";
import googleFonts from "@lumeland/plugin-google-fonts";
import imageSize from "@lumeland/plugin-image-size";
import jsonLd from "@lumeland/plugin-json-ld";
import metas from "@lumeland/plugin-metas";
import minifyHTML from "@lumeland/plugin-minify-html";
import multilanguage from "@lumeland/plugin-multilanguage";
import nav from "@lumeland/plugin-nav";
import pagefind from "@lumeland/plugin-pagefind";
import pwa from "@lumeland/plugin-pwa";
import redirects from "@lumeland/plugin-redirects";
import robots from "@lumeland/plugin-robots";
import seo from "@lumeland/plugin-seo";
import sitemap from "@lumeland/plugin-sitemap";
import slugifyPlugin from "@lumeland/plugin-slugify-urls";
import validateHTML from "@lumeland/plugin-validate-html";
import wellKnown from "@lumeland/plugin-well-known";

import typst from "../plugins/typst.ts";

import { isProduction } from "../lib/env.ts";
import typstOgImages from "../plugins/typst_og.ts";
import assets from "./assets.ts";
import feeds from "./feeds.ts";
import filters from "./filters.ts";
import markdown from "./markdown.ts";

import {
  atproto,
  author,
  git as gitMetadata,
  site as siteMetadata,
} from "./metadata.ts";

export default function () {
  const isDev = !isProduction;

  return (site: Lume.Site) => {
    site
      .use(attributes())
      .use(imageSize())
      .use(slugifyPlugin())
      .use(typst());

    // Imported statically: Lume does not await an async plugin, so the plugins registered after an await would land after the config returned.
    if (!isDev) site.use(typstOgImages());

    site
      .use(metas())
      .use(multilanguage({
        languages: ["en", "tr"],
        defaultLanguage: siteMetadata.lang,
      }))
      .use(extractDate())
      .use(date({
        formats: { URL: "yyyyMMddHHmmss" },
      }))
      .use(sitemap({
        stylesheet: "/sitemap.xsl",
      }))
      .use(redirects({ output: "netlify" }))
      .use(robots({
        rules: [
          {
            userAgent: "*",
            disallow: "/build.txt",
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
      .use(pwa())
      .use(pagefind({
        outputPath: "/pagefind",
        // search.ts drives the JS API; the component UI injects an inline script that the CSP blocks, and v4 turns it on by default.
        componentUI: false,
        indexing: {
          rootSelector: "html",
          verbose: false,
          // One Turkish page would otherwise get its own index that English pages never search.
          forceLanguage: "en",
        },
      }))
      .use(googleFonts({
        fonts:
          "https://fonts.google.com/share?selection.family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500|DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000",
        fontsFolder: "/assets/fonts",
        cssFile: "/assets/styles/site.scss",
        placeholder: "/* google-fonts */",
        subsets: ["latin", "latin-ext"],
      }))
      .use(assets())
      .use(feeds())
      .use(filters())
      .use(markdown())
      .use(gitDate({ varName: "updated" }))
      .use(gitInfo())
      .use(wellKnown({
        atProto: atproto.did,
        webfinger: {
          subject: `acct:${author.email}`,
          links: [
            {
              rel: "http://openid.net/specs/connect/1.0/issuer",
              href: `https://id.${siteMetadata.domain}`,
            },
          ],
        },
        security: {
          contact: `mailto:${author.email}`,
          expires: new Date("2027-07-11"),
          preferredLanguages: ["en", "tr"],
        },
        trust: {
          social: author.social.mastodon.url,
          contact: `mailto:${author.email}`,
          dataTrainingAllowed: false,
        },
      }));

    /** Production-only optimizations */
    if (!isDev) {
      site
        .use(minifyHTML())
        .use(checkUrls());
    }

    /**
     * SEO and HTML validation parse every page and only report findings, so they cost seconds of CPU per build and are opt-in via `LUME_CHECKS=1`.
     */
    if (process.env.LUME_CHECKS === "1") {
      site
        .use(seo({
          // The reports are only worth having on disk: the console line just says how many there were.
          output: "_reports/seo.json",
          options: {
            // Lume's common-word checks count something other than the heading (they flag `a statue.`
            // and `this is a note.` as over 45 words) and their message never interpolates `{count}`.
            // An empty set makes the count zero everywhere, leaving the length and ordering checks.
            commonWords: new Set<string>(),
            body: false,
            imgAlt: { min: 0, max: 1500, unit: "character" },
            duplicateDescription: false,
          },
        }))
        .use(validateHTML({
          output: "_reports/html.json",
          rules: {
            "attribute-empty-style": "off",
            "attribute-boolean-style": "off",
            "no-inline-style": "off",
            "no-implicit-input-type": "off",
            // `minify_html` drops attributes that only restate the default, `type` on forms included.
            "no-implicit-button-type": "off",
            "long-title": "off",
            "valid-id": "off",
          },
        }));
    }

    site.data("site", siteMetadata);
    site.data("author", author);
    site.data("git", gitMetadata);
  };
}
