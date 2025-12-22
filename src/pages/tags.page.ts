export const layout = "layouts/tag.vto";

export default function*({ search, }: Lume.Data,) {
  const tags = search.values("tags", "type=entry",);

  for (const tag of tags) {
    yield {
      url: `/tags/${tag}/`,
      title: `#${tag}`,
      tag: tag,
    };
  }
}
