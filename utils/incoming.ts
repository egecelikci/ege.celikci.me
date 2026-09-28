/**
 * Pure helpers for `incoming:` backlinks: the reverse index of the
 * doc graph. Edges come from prose body links (resolved from the
 * remark AST exactly as the engine parses them) and frontmatter
 * `sources`; listing pages and nav chrome are excluded by
 * construction — they never enter the graph. Edges are
 * language-aware: only same-language pages link each other.
 * Kept side-effect free so `utils/incoming.test.ts` can cover them.
 */

import { parseMarkdown, walk } from "./mdast.ts";

export interface IncomingEntry {
  url: string;
  title: string;
  /** page language; missing means the site default language */
  lang?: string;
  /** page date; feeds the untitled-note fallback title and ordering */
  date?: Date | string;
  /** absolute internal links found in the prose body + frontmatter */
  bodyLinks?: string[];
}

export interface IncomingLink {
  title: string;
  url: string;
  /** date of the linking page; renders newest-first */
  date?: Date | string;
}

export interface ExtractLinksOptions {
  /**
   * Absolute site origin (e.g. `https://ege.celikci.me`). Absolute
   * links to this host count as internal; without it, only paths
   * starting with `/` do.
   */
  siteUrl?: string;
}

/** Matches `href` on raw inline HTML `<a>` nodes, all quote styles. */
const HTML_HREF = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Normalizes a reference-link identifier the way mdast does. */
function referenceKey(identifier: string): string {
  return identifier.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve a raw href to an internal `/path/` target, or `null` when
 * the href is external, relative, or otherwise not a site path.
 */
function toInternalPath(
  raw: string | null | undefined,
  siteUrl?: string,
): string | null {
  if (!raw) return null;
  let path = raw.trim();

  if (/^https?:\/\//i.test(path)) {
    if (!siteUrl) return null;
    try {
      const target = new URL(path);
      const site = new URL(siteUrl);
      if (target.host !== site.host) return null;
      path = target.pathname;
    } catch {
      return null;
    }
  }

  /** Protocol-relative (`//host/x`) and relative paths stay out of the graph. */
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return normalizeUrl(path);
}

/**
 * Extract internal link targets from Markdown source.
 *
 * The source is parsed with the same remark pipeline that renders the
 * site, so titles, reference-style links, and autolinks resolve
 * exactly as written, while code blocks, image embeds, and external
 * links never enter the graph. Raw inline HTML `<a>` nodes are picked
 * up as a fallback (Vento templates and hand-written HTML in Markdown).
 *
 * @param source - Raw Markdown source (frontmatter already stripped).
 * @param options - See {@link ExtractLinksOptions}.
 * @returns Normalized `/path/` targets in document order, deduplicated.
 */
export function extractBodyLinks(
  source: string,
  options: ExtractLinksOptions = {},
): string[] {
  const found = new Set<string>();
  const add = (raw?: string | null) => {
    const internal = toInternalPath(raw, options.siteUrl);
    if (internal) found.add(internal);
  };

  const tree = parseMarkdown(source);
  if (!tree) return [];

  /**
   * Reference-style links resolve through `[ref]: /target` definitions,
   * which may appear after (or without) the referencing link.
   */
  const definitions = new Map<string, string>();
  walk(tree, (node) => {
    if (node.type === "definition" && node.identifier && node.url) {
      definitions.set(referenceKey(node.identifier), node.url);
    }
  });

  walk(tree, (node) => {
    switch (node.type) {
      case "link":
        add(node.url);
        break;
      case "linkReference": {
        const url = node.identifier
          ? definitions.get(referenceKey(node.identifier))
          : undefined;
        add(url);
        break;
      }
      case "html":
        for (const match of (node.value ?? "").matchAll(HTML_HREF)) {
          add(match[1] ?? match[2] ?? match[3]);
        }
        break;
    }
  });

  return [...found];
}

/** Normalize to `/path/` form; query strings and fragments are dropped. */
export function normalizeUrl(url: string): string {
  const path = url.split(/[?#]/)[0];
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    /** Malformed escapes stay as-is; matching is best-effort. */
  }
  const lowered = decoded.toLowerCase();
  return lowered.endsWith("/") ? lowered : lowered + "/";
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
  /**
   * en-GB abbreviates September as "Sept"; the template `MMM` grammar
   * (and every existing string) uses "Sep"
   */
  const month = get("month") === "Sept" ? "Sep" : get("month");
  return `note from ${get("day")} ${month} ${get("year")} ${get("hour")}:${
    get("minute")
  }`;
}

/**
 * Internal link targets declared in frontmatter `sources`
 * (e.g. taken-at places on notes). Accepts a single source object or
 * an array of them. Only absolute internal paths join the graph;
 * external URLs stay display-only.
 */
export function frontmatterLinks(sources: unknown): string[] {
  const list = Array.isArray(sources)
    ? sources
    : sources && typeof sources === "object"
    ? [sources]
    : [];
  const found = new Set<string>();
  for (const source of list) {
    const url = (source as { url?: unknown } | null)?.url;
    if (typeof url === "string") {
      const internal = toInternalPath(url);
      if (internal) found.add(internal);
    }
  }
  return [...found];
}

/** Newest-first; undated links last; ties broken by URL. */
function compareLinks(a: IncomingLink, b: IncomingLink): number {
  const ta = timeOf(a.date);
  const tb = timeOf(b.date);
  if (Number.isNaN(ta) !== Number.isNaN(tb)) {
    return Number.isNaN(ta) ? 1 : -1;
  }
  if (!Number.isNaN(ta) && ta !== tb) return tb - ta;
  return a.url.localeCompare(b.url);
}

function timeOf(date?: Date | string): number {
  if (!date) return NaN;
  const time = date instanceof Date ? date.getTime() : Date.parse(date);
  return Number.isNaN(time) ? NaN : time;
}

/**
 * Build the reverse index: for every page, who links to it.
 * Body edges: prose links and frontmatter sources between existing
 * pages. Language edges: only same-language pages link each other; a
 * page without `lang` counts as the default language.
 *
 * Tags deliberately stay out of the graph: tag membership is a
 * listing mechanism rendered by TagDetail, not a content link, and
 * tag pages never display `incoming:`.
 */
export function buildIncoming(
  entries: IncomingEntry[],
  options: {
    defaultLang?: string;
  } = {},
): Map<string, IncomingLink[]> {
  const { defaultLang = "en" } = options;
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

    const incoming: IncomingLink = {
      title: noteTitle(from.title, from.date),
      url: from.url,
    };
    if (from.date) incoming.date = from.date;
    edges.get(to)!.set(from.url, incoming);
  };

  for (const entry of entries) {
    for (const target of entry.bodyLinks ?? []) {
      link(entry, target);
    }
  }

  const result = new Map<string, IncomingLink[]>();
  for (const [url, links] of edges) {
    result.set(url, [...links.values()].sort(compareLinks));
  }
  return result;
}
