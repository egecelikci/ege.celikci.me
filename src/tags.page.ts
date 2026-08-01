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
      navigation: {
        parent: "/tags/",
      },
    };
  }
}
