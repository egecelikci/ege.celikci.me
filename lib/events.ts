/**
 * Pure helpers for enriching MusicBrainz event data.
 * Kept free of side effects so they can be unit tested.
 */

import type { MBEvent, MBRelation, RawIzmirEvents } from "./schemas.ts";

/** Roles that aren't performers (posters, design, etc.) */
export const NON_PERFORMER_ROLES = [
  "illustration",
  "graphic design",
  "artwork",
  "design",
  "engineer",
];

/** Parse an ISO date string, tolerating bad input. */
export function parseEventDate(beginStr?: string | null): Date | null {
  if (!beginStr) return null;
  const d = new Date(beginStr);
  return isNaN(d.getTime()) ? null : d;
}

/** An event is upcoming when it starts today or later and isn't cancelled. */
export function isEventUpcoming(
  beginDate: Date | null,
  ended: boolean,
  cancelled: boolean,
  today: Date,
): boolean {
  return (beginDate ? beginDate >= today : !ended) && !cancelled;
}

/** Resolve the venue name from a place relation. */
export function resolveVenueName(
  local?: LocalEventData,
  venueRel?: MBRelation,
): string | undefined {
  return local?.venue_name || venueRel?.["target-credit"] ||
    venueRel?.place?.name;
}

/** Extract performer names from artist relations, excluding non-performers. */
export function extractArtists(
  relations: MBRelation[] | undefined,
): string[] {
  return (relations || [])
    .filter((r) =>
      r["target-type"] === "artist" && !NON_PERFORMER_ROLES.includes(r.type)
    )
    .map((r) => r["target-credit"] || r.artist?.name)
    .filter((name): name is string => Boolean(name));
}

/** Build the display title from performers, venue, and the event name. */
export function buildDisplayTitle(
  artists: string[],
  eventName: string,
  venueName?: string,
): string {
  let title = "";
  if (artists.length === 0) {
    title = eventName;
  } else if (artists.length === 1) {
    title = artists[0];
  } else if (artists.length === 2) {
    title = artists.join(" & ");
  } else {
    const others = artists.slice(0, -1);
    const last = artists[artists.length - 1];
    title = `${others.join(", ")} & ${last}`;
  }

  if (venueName) {
    title += ` @ ${venueName}`;
  }
  return title;
}

/** Heuristic: if none of the artist names appear in the event name verbatim,
 * it's likely a real custom title. */
export function detectCustomTitle(
  eventName: string,
  artists: string[],
): boolean {
  if (artists.length === 0) return Boolean(eventName);
  const nameLower = eventName.toLowerCase();
  return !artists.some((a) => nameLower.includes(a.toLowerCase()));
}

/** Sort events by begin date (ascending or descending). */
export function sortByDate<T extends { beginDate: string | null }>(
  a: T,
  b: T,
  desc = false,
): number {
  const da = a.beginDate ? new Date(a.beginDate).getTime() : 0;
  const db = b.beginDate ? new Date(b.beginDate).getTime() : 0;
  return desc ? db - da : da - db;
}

/** Filter label relations, dropping excluded labels. */
export function filterLabels(
  relations: MBRelation[] | undefined,
  excludeLabels: string[],
): MBRelation[] {
  return (relations ?? [])
    .filter((r) =>
      r["target-type"] === "label" &&
      !excludeLabels.includes(r.label?.id ?? "")
    );
}

/** Local event metadata from src/_data/events.yml */
export interface LocalEventData {
  title?: string;
  description?: string;
  instagram_url?: string | string[];
  venue_name?: string;
  price?: string;
  video?: { src: string; title?: string };
  exclude_labels?: string[];
  setlist?: string;
  photographers?: Record<string, { name: string; url?: string }>;
  photographer?: { name: string; url?: string };
  /**
   * The event poster is AI-generated. Listing cards show a disclosure tile instead of the image; the detail page veils it as a spoiler.
   */
  ai_poster?: boolean;
}

/** An event after the events preprocessor has enriched it at build time */
export interface EnrichedMBEvent extends MBEvent {
  beginDate: string | null;
  isUpcoming: boolean;
  displayTitle: string;
  artists: string[];
  isCustomTitle: boolean;
  local: LocalEventData;
  venueName?: string;
  labels?: MBRelation[];
  /** Set by the events preprocessor to guard against double enrichment */
  _enriched?: boolean;
}

/**
 * Enriched events built at build time by the events preprocessor; never saved to disk.
 */
export interface EnrichedIzmirEvents extends RawIzmirEvents {
  events: EnrichedMBEvent[];
  all: EnrichedMBEvent[];
  upcoming: EnrichedMBEvent[];
  past: EnrichedMBEvent[];
}
