export const layout = "layouts/page.vto";
export const searchable = false;

export default function* ({ search }: any, { slugify }: any) {
  const tags = search.values("tags");

  for (const tag of tags) {
    if (tag === "recipes") continue; // Handled by custom page src/pages/recipes.vto

    yield {
      url: `/tags/${slugify(tag)}/`,
      tag,
      title: `#${tag}`,
      type: "tag",
      backlink: { href: "/tags/", text: "topics" },
      headerExtension: {
        comp: "features.TagFeeds",
        props: { tag },
      },
      prose: false,
    };
  }
}
