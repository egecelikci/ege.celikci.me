/**
 * _config/feeds.ts
 * RSS and JSON feed orchestration.
 */

import feed, { Options as FeedOptions, } from "lume/plugins/feed.ts";
import { site as siteData, } from "./metadata.ts";

export default function(options: FeedOptions = {},) {
  return (site: Lume.Site,) => {
    // Common configuration for feed items
    const items = {
      title: "=title",
      description: "=excerpt || =description",
      content: (data: any,) => {
        let html = data.content as string;

        // If the page has extracted images (e.g. from the preprocessor), prepend them to the feed content
        if (
          data.images && Array.isArray(data.images,) && data.images.length > 0
        ) {
          const imagesHtml = data.images
            .map((img: any,) =>
              `<p><img src="${site.url(img.src, true,)}" alt="${
                img.alt || ""
              }" /></p>`
            )
            .join("",);
          html = imagesHtml + html;
        }

        return html;
      },
    };

    // 1. All-in-one feed (Blog + Notes)
    site.use(feed({
      ...options,
      output: ["/feed.atom", "/feed.json",],
      query: "type=post|note",
      info: {
        title: siteData.host,
        description: siteData.description,
      },
      items,
    },),);

    // 2. Notes-only feed
    site.use(feed({
      ...options,
      output: ["/notes.atom", "/notes.json",],
      query: "type=note",
      info: {
        title: `notes | ${siteData.host}`,
        description: siteData.description,
      },
      items,
    },),);

    // 3. Blog-only feed
    site.use(feed({
      ...options,
      output: ["/blog.atom", "/blog.json",],
      query: "type=post",
      info: {
        title: `blog | ${siteData.host}`,
        description: siteData.description,
      },
      items,
    },),);

    // 4. Per-tag feeds
    site.use(feed(() => {
      const tags = site.search.values("tags",);
      return tags.map((tag,) => {
        const slug = tag.toLowerCase().replace(/[^a-z0-9]/g, "-",).replace(
          /-+/g,
          "-",
        );
        return {
          output: [`/tags/${slug}.atom`, `/tags/${slug}.json`,],
          query: `'${tag}'`,
          info: {
            title: `topic: ${tag} | ${siteData.host}`,
            description: `all entries tagged with ${tag}`,
          },
          items,
        };
      },);
    },),);
  };
}
