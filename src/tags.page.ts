export const layout = "layouts/tag.vto";

export default function*({ search, }: any, { slugify, }: any,) {
  const tags = search.values("tags",);

  for (const tag of tags) {
    yield {
      url: `/tags/${slugify(tag,)}/`,
      tag,
    };
  }
}
