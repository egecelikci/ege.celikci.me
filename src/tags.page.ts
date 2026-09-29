export const layout = "layouts/page.vto";
export const searchable = true;

export default function* ({ search }: Lume.Data, { slugify }: Lume.Helpers) {
  const tags = search.values<string>("tags");

  for (const tag of tags) {
    yield {
      url: `/tags/${slugify(tag)}/`,
      tag,
      title: `#${tag}`,
      type: "tag",
      prose: false,
      /* Kedi photos are also aggregated at subversive.pics; a declared link with a relation, not a feed (feeds are advertised from _config/feeds.ts). */
      links: tag === "kedi"
        ? [{
          label: "subversive.pics",
          relation: "also on",
          url: "https://subversive.pics/",
          icon: "image",
        }]
        : undefined,
      navigation: {
        parent: "/tags/",
      },
    };
  }
}
