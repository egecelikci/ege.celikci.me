import feed, { Options as FeedOptions } from "lume/plugins/feed.ts";
import createSlugifier from "lume/core/slugifier.ts";
import { site as siteData } from "./metadata.ts";
import feedConfigs from "../src/_data/feeds.ts";

const slugify = createSlugifier();

export default function (options: FeedOptions = {}) {
  return (site: Lume.Site) => {
    const items = {
      title: "=title",
      description: "=excerpt || =description",
      content: (data: Lume.Data<Lume.GlobalData>) => {
        let html = (data.content || data.description || "") as string;

        if (
          data.images && Array.isArray(data.images) && data.images.length > 0
        ) {
          const timestamp = Math.floor(data.date.getTime() / 1000);
          const imagesHtml = data.images
            .map((img) => {
              const fullSrc = site.url(img.src, true);

              return `<img class="webring" src="${fullSrc}" data-timestamp="${timestamp}" data-thumb="" alt="${
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

    for (const config of feedConfigs) {
      site.use(feed({
        ...options,
        output: config.output,
        query: config.query,
        limit: config.limit,
        info: {
          ...commonInfo,
          ...config.info,
        },
        items,
      }));
    }

    site.use(feed(() => {
      const tags = site.search.values<string>("tags");

      return tags.map((tag) => {
        const slug = slugify(tag);
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
