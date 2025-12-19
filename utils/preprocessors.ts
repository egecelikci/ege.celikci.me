import settings from "../src/_data/site.ts";

export default function(site: any,) {
  site.preprocess([".md",], (pages: any[],) => {
    for (const page of pages) {
      if (page.src.path.startsWith("/notes/",)) {
        const stats = { likes: 0, reposts: 0, replies: 0, };
        const webmentions = page.data.webmentions;

        if (webmentions && Array.isArray(webmentions.children,)) {
          const siteUrl = settings.url;
          const pageUrl = (siteUrl + page.data.url).replace(/\/+$/, "",);
          const relevantMentions = webmentions.children.filter(
            (entry: any,) => {
              const target = (entry["wm-target"] || "").replace(/\/+$/, "",);
              return target === pageUrl;
            },
          );

          stats.likes = relevantMentions.filter(
            (m: any,) => m["wm-property"] === "like-of",
          ).length;

          stats.reposts = relevantMentions.filter(
            (m: any,) => m["wm-property"] === "repost-of",
          ).length;

          stats.replies = relevantMentions.filter((m: any,) =>
            ["mention-of", "in-reply-to",].includes(m["wm-property"],)
          ).length;
        }

        page.data.stats = stats;
      }
    }
  },);
  site.preprocess([".md",], (pages: any[],) => {
    for (const page of pages) {
      if (page.data.type === "note") {
        const rawContent = page.data.content as string;
        const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
        const foundImages = [];
        let match;

        while ((match = imgRegex.exec(rawContent,)) !== null) {
          foundImages.push({ alt: match[1], src: match[2], },);
        }
        page.data.images = foundImages;

        const rssImagesHtml = foundImages.map(img => {
          const absoluteSrc = site.url(img.src, true,);
          return `<figure><img src="${absoluteSrc}" alt="${img.alt}"></figure>`;
        },).join("",);

        page.data.rssContent = rssImagesHtml
          + rawContent.replace(imgRegex, "",);

        page.data.content = rawContent.replace(imgRegex, "",);
      }
    }
  },);
}
