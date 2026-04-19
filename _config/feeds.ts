/**
 * _config/feeds.ts
 * RSS and JSON feed orchestration.
 */

import feed, { Options as FeedOptions, } from "lume/plugins/feed.ts";
import { site as siteData, } from "./metadata.ts";

export default function(options: FeedOptions = {},) {
  return (site: Lume.Site,) => {
    // 1. All-in-one feed (Blog + Notes)
    site.use(feed({
      ...options,
      output: ["/feed.atom", "/feed.json",],
      query: "type=post|note",
      info: {
        title: siteData.host,
        description: siteData.description,
      },
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
          items: {
            title: "=title",
            description: "=excerpt || =description",
            content: "=content",
          },
        };
      },);
    },),);
  };
}
