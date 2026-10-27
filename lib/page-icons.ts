/**
 * Icon for a page, derived from what the page is: one of its tags first, then its type, then a neutral page glyph.
 * Used where pages are listed *as links* (the `incoming:` line, entry timelines) so a link says what kind of page it points at instead of carrying a decorative glyph.
 */

export interface PageIcon {
  icon: string;
  catalog: string;
}

/** One entry per tag this site uses; first matching tag wins. */
const BY_TAG: Record<string, PageIcon> = {
  kedi: { icon: "cat-broken", catalog: "solar" },
  places: { icon: "map-pin", catalog: "lucide" },
  venues: { icon: "map-pin", catalog: "lucide" },
  pubs: { icon: "map-pin", catalog: "lucide" },
  neighborhood: { icon: "map-pin", catalog: "lucide" },
  recipes: { icon: "chef-hat", catalog: "lucide" },
  coffee: { icon: "coffee", catalog: "lucide" },
  cicek: { icon: "flower-2", catalog: "lucide" },
  dessert: { icon: "cake-slice", catalog: "lucide" },
  games: { icon: "gamepad-2", catalog: "lucide" },
  music: { icon: "music", catalog: "lucide" },
  yearinmusic: { icon: "music", catalog: "lucide" },
  listenbrainz: { icon: "music", catalog: "lucide" },
  feeds: { icon: "rss", catalog: "lucide" },
  links: { icon: "link", catalog: "lucide" },
  setup: { icon: "terminal", catalog: "lucide" },
  software: { icon: "terminal", catalog: "lucide" },
  meta: { icon: "info", catalog: "lucide" },
  label: { icon: "tag", catalog: "lucide" },
};

const BY_TYPE: Record<string, PageIcon> = {
  note: { icon: "sticky-note", catalog: "lucide" },
  entry: { icon: "file-text", catalog: "lucide" },
  tag: { icon: "hash", catalog: "lucide" },
  index: { icon: "list", catalog: "lucide" },
};

const FALLBACK: PageIcon = { icon: "file-text", catalog: "lucide" };

export function pageIcon(
  page: { type?: string; tags?: string | string[] },
): PageIcon {
  /** Lume page data allows a single tag as a bare string. */
  const tags = Array.isArray(page.tags)
    ? page.tags
    : page.tags
    ? [page.tags]
    : [];

  return tags.map((tag) => BY_TAG[tag]).find(Boolean) ??
    BY_TYPE[page.type ?? ""] ??
    FALLBACK;
}
