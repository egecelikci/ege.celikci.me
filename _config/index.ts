/**
 * Main configuration orchestrator.
 */

Deno.env.set("TZ", "Europe/Istanbul");

import "./types.ts";

import attributes from "lume/plugins/attributes.ts";
import checkUrls from "lume/plugins/check_urls.ts";
import date from "lume/plugins/date.ts";
import extractDate from "lume/plugins/extract_date.ts";
import favicon from "lume/plugins/favicon.ts";
import gitDate from "lume/plugins/git_date.ts";
import gitInfo from "lume/plugins/git_info.ts";
import googleFonts from "lume/plugins/google_fonts.ts";
import imageSize from "lume/plugins/image_size.ts";
import jsonLd from "lume/plugins/json_ld.ts";
import metas from "lume/plugins/metas.ts";
import minifyHTML from "lume/plugins/minify_html.ts";
import multilanguage from "lume/plugins/multilanguage.ts";
import nav from "lume/plugins/nav.ts";
import pagefind from "lume/plugins/pagefind.ts";
import pwa from "lume/plugins/pwa.ts";
import redirects from "lume/plugins/redirects.ts";
import robots from "lume/plugins/robots.ts";
import seo from "lume/plugins/seo.ts";
import sitemap from "lume/plugins/sitemap.ts";
import slugifyPlugin from "lume/plugins/slugify_urls.ts";
import validateHTML from "lume/plugins/validate_html.ts";
import wellKnown from "lume/plugins/well_known.ts";

import typst from "typst";

import { isProduction } from "../utils/env.ts";
import typstOgImages from "../utils/plugins/typst_og.ts";
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
        // search.ts drives the JS API; the default UI injects an inline script that the CSP blocks.
        ui: false,
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
    if (Deno.env.get("LUME_CHECKS") === "1") {
      site
        .use(seo({
          options: {
            body: false,
            imgAlt: { min: 0, max: 1500, unit: "character" },
            duplicateDescription: false,
          },
        }))
        .use(validateHTML({
          rules: {
            "attribute-empty-style": "off",
            "attribute-boolean-style": "off",
            "no-inline-style": "off",
            "no-implicit-input-type": "off",
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
