export const layout = "layouts/page.vto";
export const searchable = false;

export default function* ({ search }: any, { slugify }: any) {
  const tags = search.values("tags");

  for (const tag of tags) {
    yield {
      url: `/tags/${slugify(tag)}/`,
      tag,
      title: `#${tag}`,
      type: "tag",
      prose: false,
    };
  }
}
