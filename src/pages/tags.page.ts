export const layout = "layouts/tag.vto";

export default function* ({ search }, { slugify }) {
  // 1. Get every unique tag
  const tags = search.values("tags");

  for (const tag of tags) {
    yield {
      url: `/tags/${slugify(tag)}/`,
      tag: tag,
    };
  }
}