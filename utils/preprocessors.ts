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
      // Only process pages that are 'notes' and have an images array
      if (page.data.type === "note" && page.data.images) {
        const imagesHtml = page.data.images.map((img: any,) => {
          const src = typeof img === "string" ? img : img.src;
          // Generate absolute URL for RSS compatibility
          const absoluteSrc = site.url(src, true,);
          return `<figure><img src="${absoluteSrc}" alt="${
            img.alt || ""
          }"></figure>`;
        },).join("",);

        // Prepend the images to the actual content
        page.data.content = imagesHtml + page.data.content;
      }
    }
  },);
}
