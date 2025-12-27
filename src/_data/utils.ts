/**
 * Finds content (posts and pages) that share tags with the current page.
 */
export function getRelatedContent(
  search: any,
  currentUrl: string,
  tags: string[] | undefined,
) {
  // 1. Safety check: if no tags, return empty results
  if (!tags || !Array.isArray(tags,) || tags.length === 0) {
    return { posts: [], pages: [], };
  }

  // 2. Helper to check for tag intersection
  const hasOverlap = (itemTags: string[] | undefined,) => {
    return itemTags?.some(tag => tags.includes(tag,));
  };

  // 3. Find matching Posts
  const posts = search.pages("type=post", "date=desc",)
    .filter((p: any,) => p.url !== currentUrl && hasOverlap(p.tags,));

  // 4. Find matching Pages (excluding the current one)
  const pages = search.pages("type=page", "date=desc",)
    .filter((p: any,) => p.url !== currentUrl && hasOverlap(p.tags,));

  return { posts, pages, };
}
