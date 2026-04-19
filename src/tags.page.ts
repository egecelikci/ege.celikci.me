export const layout = "layouts/tag.vto";

export default function* ({ search }: any, { slugify }: any) {
  const tags = search.values("tags");

  for (const tag of tags) {
    if (tag === "recipes") continue; // Handled by custom page src/pages/recipes.vto

    yield {
      url: `/tags/${slugify(tag)}/`,
      tag,
    };
  }
}
