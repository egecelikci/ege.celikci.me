/**
 * Incremental webmention.io sync, kept free of I/O so it can be tested with a fake page fetcher.
 * @module
 */

import type { Webmention, WebmentionFeed } from "../src/types/index.ts";
import { WebmentionSchema } from "./schemas.ts";

/** One page of the webmention.io `mentions.jf2` API, or `null` when the request failed. */
export type FetchPage = (params: URLSearchParams) => Promise<unknown | null>;

/** Options for {@link syncWebmentions}. */
export interface SyncOptions {
  /** Mentions per request; webmention.io caps this at 10000. */
  perPage?: number;
  /** Stops a runaway loop if the API keeps returning full pages. */
  maxPages?: number;
  /** Clock used for `lastFetched`, injectable for tests. */
  now?: () => Date;
}

/** Result of {@link parseMentions}. */
export interface ParsedMentions {
  mentions: Webmention[];
  dropped: number;
}

/**
 * Validate each mention on its own, so one unsupported or malformed entry cannot reject the whole batch.
 *
 * @param data - A raw `mentions.jf2` response body.
 * @returns The valid mentions and how many were dropped, or `null` when the body is not a jf2 feed at all.
 */
export function parseMentions(data: unknown): ParsedMentions | null {
  if (
    !data || typeof data !== "object" ||
    !Array.isArray((data as { children?: unknown }).children)
  ) {
    return null;
  }
  const mentions: Webmention[] = [];
  let dropped = 0;
  for (const item of (data as { children: unknown[] }).children) {
    const result = WebmentionSchema.safeParse(item);
    if (result.success) mentions.push(result.data);
    else dropped++;
  }
  return { mentions, dropped };
}

/**
 * Merge incoming mentions into the stored ones by `wm-id`, newest `wm-received` first.
 *
 * @param existing - Stored mentions; not mutated.
 * @param incoming - Freshly fetched mentions; they replace stored ones with the same id.
 * @returns The merged list and how many entries were added or changed.
 */
export function mergeMentions(
  existing: Webmention[],
  incoming: Webmention[],
): { mentions: Webmention[]; added: number; updated: number } {
  const byId = new Map(existing.map((m) => [m["wm-id"], m]));
  let added = 0;
  let updated = 0;
  for (const mention of incoming) {
    const prior = byId.get(mention["wm-id"]);
    if (!prior) added++;
    else if (JSON.stringify(prior) !== JSON.stringify(mention)) updated++;
    else continue;
    byId.set(mention["wm-id"], mention);
  }
  const mentions = [...byId.values()].sort((a, b) =>
    Date.parse(b["wm-received"]) - Date.parse(a["wm-received"]) ||
    b["wm-id"] - a["wm-id"]
  );
  return { mentions, added, updated };
}

/**
 * Fetch everything newer than the highest stored `wm-id` and merge it into the feed.
 *
 * Advancing by id instead of by date means an empty or failed run never skips mentions, and a failed page keeps the stored feed unchanged.
 *
 * @param feed - The stored feed.
 * @param fetchPage - Fetches one API page for the given query parameters.
 * @param options - Paging limits and the clock.
 * @returns The updated feed, or the stored feed unchanged when nothing new arrived or a page failed.
 */
export async function syncWebmentions(
  feed: WebmentionFeed,
  fetchPage: FetchPage,
  options: SyncOptions = {},
): Promise<
  { feed: WebmentionFeed; added: number; updated: number; dropped: number }
> {
  const { perPage = 1000, maxPages = 100, now = () => new Date() } = options;
  const sinceId = feed.children.reduce(
    (max, m) => Math.max(max, m["wm-id"]),
    0,
  );
  const incoming: Webmention[] = [];
  let dropped = 0;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      "per-page": String(perPage),
      page: String(page),
    });
    if (sinceId > 0) params.set("since_id", String(sinceId));

    const parsed = parseMentions(await fetchPage(params));
    if (!parsed) {
      throw new Error(`page ${page} failed or was not a jf2 feed`);
    }
    incoming.push(...parsed.mentions);
    dropped += parsed.dropped;
    if (parsed.mentions.length + parsed.dropped < perPage) break;
  }

  const merged = mergeMentions(feed.children, incoming);
  if (merged.added === 0 && merged.updated === 0) {
    return { feed, added: 0, updated: 0, dropped };
  }
  return {
    feed: {
      schemaVersion: 1,
      children: merged.mentions,
      lastFetched: now().toISOString(),
    },
    added: merged.added,
    updated: merged.updated,
    dropped,
  };
}
