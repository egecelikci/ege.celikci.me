export const layout = "layouts/bookmarks.vto";

interface Bookmark {
  title: string;
  url?: string;
  categories?: string[];
  desc?: string;
  img?: string;
  feed?: string;
  mirrors?: string[];
}

interface CategoryMetadata {
  id: string;
  title?: string;
  icon?: string;
  desc?: string;
  count?: number; // injected at build time; not present in raw YAML
}

interface BookmarkData {
  categories: CategoryMetadata[];
  links: Bookmark[];
}

export default async function* (
  { bookmarks }: {
    bookmarks: BookmarkData;
  },
) {
  const { categories: rawCategoryMetadata, links } = bookmarks;

  // Semantic fields drive auto-category injection:
  // - `img`  → 88x31 (site has a badge)
  // - `feed` → blogroll (site is subscribable)
  const normalizedLinks = links.map((link) => {
    const categories = [...(link.categories ?? [])];
    if (link.img && !categories.includes("88x31")) categories.push("88x31");
    if (link.feed && !categories.includes("blogroll")) {
      categories.push("blogroll");
    }
    return { ...link, categories };
  });

  const categoryCounts = normalizedLinks.reduce((acc, link) => {
    link.categories.forEach((cat) => acc[cat] = (acc[cat] || 0) + 1);
    return acc;
  }, {} as Record<string, number>);

  const allCategoryIds = [
    ...new Set(normalizedLinks.flatMap((l) => l.categories)),
  ];

  const sortedCategoryIds = allCategoryIds.sort((a, b) => {
    const aHasMeta = rawCategoryMetadata.some((m) => m.id === a);
    const bHasMeta = rawCategoryMetadata.some((m) => m.id === b);
    if (aHasMeta && !bHasMeta) return -1;
    if (!aHasMeta && bHasMeta) return 1;
    const aCount = categoryCounts[a] || 0;
    const bCount = categoryCounts[b] || 0;
    if (aCount !== bCount) return bCount - aCount;
    return a.localeCompare(b);
  });

  // Enrich categoryMetadata with computed counts so counts survive layout
  // prop-passing without needing a separate categoryCounts object in the template.
  const categoryMetadata: CategoryMetadata[] = sortedCategoryIds.map((id) => {
    const raw = rawCategoryMetadata.find((m) => m.id === id) ?? { id };
    return { ...raw, count: categoryCounts[id] ?? 0 };
  });

  const totalCount = normalizedLinks.length;

  // /bookmarks/ — all items
  yield {
    url: "/bookmarks/",
    title: "bookmarks",
    description: "curated collection of favorite links & resources",
    prose: false,
    activeCategory: null,
    allCategoryIds: sortedCategoryIds,
    categoryMetadata,
    totalCount,
    filteredBookmarks: normalizedLinks,
    backlink: { href: "/", text: "home" },
    menu: { group: "collections", label: "internet", order: 1 },
  };

  // /bookmarks/[category]/ — per-category filtered views
  for (const catId of sortedCategoryIds) {
    const meta = categoryMetadata.find((m) => m.id === catId);
    yield {
      url: `/bookmarks/${catId}/`,
      title: meta?.title ?? catId,
      description: meta?.desc ??
        `curated collection of favorite links & resources in ${catId}`,
      prose: false,
      activeCategory: catId,
      allCategoryIds: sortedCategoryIds,
      categoryMetadata,
      totalCount,
      filteredBookmarks: normalizedLinks.filter((l) =>
        l.categories.includes(catId)
      ),
      backlink: { href: "/bookmarks/", text: "bookmarks" },
    };
  }
}
