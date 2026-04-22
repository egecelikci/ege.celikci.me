export const layout = "layouts/page.vto";
export const searchable = false;

export default function*({ search, }: any, { slugify, }: any,) {
  const tags = search.values("tags",);

  for (const tag of tags) {
    const isRecipes = tag === "recipes";

    yield {
      url: `/tags/${slugify(tag,)}/`,
      tag,
      title: `#${tag}`,
      type: "tag",
      prose: false,
      ...(isRecipes
        ? {
          menu_label: "atlas",
          menu_order: 8,
          label: "treats",
        }
        : {}),
    };
  }
}
