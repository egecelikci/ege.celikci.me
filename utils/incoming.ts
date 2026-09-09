/**
 * utils/incoming.ts
 * Pure helpers for `incoming:` backlinks: the reverse index of the
 * doc graph. Edges come from tag memberships and prose body links
 * (absolute internal paths); listing pages and nav chrome are excluded
 * by construction — they never enter the graph. Edges are
 * language-aware: only same-language pages link each other.
 * Kept side-effect free so `utils/incoming.test.ts` can cover them.
 */

export interface IncomingEntry {
  url: string;
  title: string;
  /** page language; missing means the site default language */
  lang?: string;
  /** page date; feeds the untitled-note fallback title */
  date?: Date | string;
  /** tags on the page itself */
  tags?: string[];
  /** absolute internal links found in the prose body, e.g. ["/music/"] */
  bodyLinks?: string[];
}

export interface IncomingLink {
  title: string;
  url: string;
}

/** Extract absolute internal link targets from markdown source. */
export function extractBodyLinks(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\[[^\]]*\]\((\/[^)\s#?]+)\/?(?:[#?][^)\s]*)?\)/g,
    /<a\s+[^>]*href="(\/[^"#\s]+)(?:[#?][^"\s]*)?"/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.add(normalizeUrl(match[1]));
    }
  }
  return [...found];
}

/** Normalize to `/path/` form; query strings and fragments are dropped. */
export function normalizeUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.endsWith("/") ? path : path + "/";
}

/**
 * Display title for a graph node. Untitled notes fall back to
 * `note from <date>` — the same grammar as <title> and pagefind
 * metadata — so every standalone reference is self-identifying.
 */
export function noteTitle(title: string, date?: Date | string): string {
  if (title) return title;
  const parsed = date instanceof Date ? date : date ? new Date(date) : null;
  if (!parsed || isNaN(parsed.getTime())) return "note";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // en-GB abbreviates September as "Sept"; the template `MMM` grammar
  // (and every existing string) uses "Sep"
  const month = get("month") === "Sept" ? "Sep" : get("month");
  return `note from ${get("day")} ${month} ${get("year")} ${get("hour")}:${
    get("minute")
  }`;
}

/**
 * Internal link targets declared in frontmatter `sources`
 * (e.g. taken-at places on notes). Only absolute internal paths
 * join the graph; external URLs stay display-only.
 */
export function frontmatterLinks(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  const found = new Set<string>();
  for (const source of sources) {
    const url = (source as { url?: unknown } | null)?.url;
    if (typeof url === "string" && url.startsWith("/")) {
      found.add(normalizeUrl(url));
    }
  }
  return [...found];
}

/**
 * Build the reverse index: for every page, who links to it.
 * Tag edges: a tag page gains every page carrying that tag.
 * Body edges: prose links between existing pages.
 * Language edges: only same-language pages link each other; a page
 * without `lang` counts as the default language.
 */
export function buildIncoming(
  entries: IncomingEntry[],
  options: {
    slugifyTag?: (tag: string) => string;
    defaultLang?: string;
  } = {},
): Map<string, IncomingLink[]> {
  const { slugifyTag = (t: string) => t, defaultLang = "en" } = options;
  const known = new Map(entries.map((e) => [normalizeUrl(e.url), e]));
  const edges = new Map<string, Map<string, IncomingLink>>();
  const effectiveLang = (lang?: string) => lang ?? defaultLang;

  const link = (from: IncomingEntry, toUrl: string) => {
    const to = normalizeUrl(toUrl);
    if (to === normalizeUrl(from.url)) return;
    const target = known.get(to);
    if (!target) return;
    if (effectiveLang(from.lang) !== effectiveLang(target.lang)) return;
    if (!edges.has(to)) edges.set(to, new Map());
    edges.get(to)!.set(from.url, {
      title: noteTitle(from.title, from.date),
      url: from.url,
    });
  };

  for (const entry of entries) {
    for (const tag of entry.tags ?? []) {
      link(entry, `/tags/${slugifyTag(tag)}/`);
    }
    for (const target of entry.bodyLinks ?? []) {
      link(entry, target);
    }
  }

  const result = new Map<string, IncomingLink[]>();
  for (const [url, links] of edges) {
    result.set(
      url,
      [...links.values()].sort((a, b) => a.url.localeCompare(b.url)),
    );
  }
  return result;
}
