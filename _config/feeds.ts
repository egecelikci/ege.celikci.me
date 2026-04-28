/**
 * _config/feeds.ts
 * RSS and JSON feed orchestration.
 */

import feed, { Options as FeedOptions } from "lume/plugins/feed.ts";
import { site as siteData } from "./metadata.ts";
import feedConfigs from "../src/_data/feeds.ts";

export default function (options: FeedOptions = {}) {
  return (site: Lume.Site) => {
    // Common configuration for feed items
    const items = {
      title: "=title",
      description: "=excerpt || =description",
      content: (data: any) => {
        let html = data.content as string;

        // If the page has extracted images (e.g. from the preprocessor), prepend them to the feed content
        if (
          data.images && Array.isArray(data.images) && data.images.length > 0
        ) {
          const timestamp = Math.floor(data.date.getTime() / 1000);
          const imagesHtml = data.images
            .map((img: any) => {
              const fullSrc = site.url(img.src, true);
              let thumb = "";
              if (img.src.includes("/gallery/")) {
                thumb = site.url(
                  img.src.replace(/(\.[a-z]+)$/i, "-preview.jpg"),
                  true,
                );
              }

              return `<img class="webring" src="${fullSrc}" data-timestamp="${timestamp}" data-thumb="${thumb}" alt="${
                img.alt || ""
              }">`;
            })
            .join("\n");
          html = imagesHtml + "\n" + html;
        }

        return html;
      },
      image: "=coverImage",
    };

    const commonInfo = {
      lang: siteData.lang,
      color: "#a60c49",
      icon: "/assets/images/favicon/apple-touch-icon.png",
      image: "/assets/images/favicon/android-chrome-512x512.png",
      generator: true,
    };

    // 1. Register Feeds with Lume
    for (const config of feedConfigs) {
      site.use(feed({
        ...options,
        output: config.output,
        query: config.query,
        info: {
          ...commonInfo,
          ...config.info,
        },
        items,
      }));
    }

    // 2. Per-tag feeds
    site.use(feed(() => {
      const tags = site.search.values("tags");
      return tags.map((tag) => {
        const slug = tag.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(
          /-+/g,
          "-",
        );
        return {
          output: [`/tags/${slug}.atom`, `/tags/${slug}.json`],
          query: `'${tag}'`,
          info: {
            ...commonInfo,
            title: `topic: ${tag} | ${siteData.host}`,
            description: `all entries tagged with ${tag}`,
          },
          items,
        };
      });
    }));
  };
}
