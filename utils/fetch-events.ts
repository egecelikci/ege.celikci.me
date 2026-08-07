/**
 * src/utils/fetch-events.ts
 *
 * Fetches and caches MusicBrainz events for the İzmir area.
 * Saves results to src/_data/mb_events.json for Lume to pick up.
 * Downloads event posters locally for archival and reliability.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { loadState, saveState, sortObjectKeys } from "./cache.ts";
import { HttpClient } from "./fetch-base.ts";
import { exists } from "@std/fs/exists";
import {
  EAAPosterInfoSchema,
  EntityDetailsSchema,
  MBEventListSchema,
  RawIzmirEventsSchema,
  validate,
  validateOrThrow,
} from "./schemas.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const IZMIR_AREA_MBID = "f6a9a62a-23b1-4f2e-b2f0-ac36f113f0b5";
const MB_API = "https://musicbrainz.org/ws/2";
const EAA_API = "https://eventartarchive.org";
const USER_AGENT = "ege.celikci.me/1.0 (ege@celikci.me)";

const CONFIG = {
  fetchLimit: 100,
  rateLimitDelayMs: 1100,

  paths: {
    cacheFile: join(Deno.cwd(), "src", "_data", "mb_events.json"),
    posters: "src/assets/images/posters",
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

/** An external link harvested for a MusicBrainz entity (homepage, instagram, ...) */
export interface MBEntityLink {
  type: string;
  url: string;
}

/** Common fields shared by MusicBrainz relation targets */
interface MBEntityBase {
  id: string;
  name: string;
  "sort-name"?: string;
  disambiguation?: string;
  /** Links harvested for this entity, merged by the events preprocessor */
  externalLinks?: MBEntityLink[];
}

export interface MBRelationArtist extends MBEntityBase {
  "sort-name": string;
  country?: string | null;
  type?: string | null;
  "type-id"?: string | null;
}

export interface MBRelationPlace extends MBEntityBase {
  address?: string;
  coordinates?: { latitude: number; longitude: number } | null;
  area?: MBRelationArtist;
}

export interface MBRelationLabel extends MBEntityBase {
  "sort-name": string;
  "label-code"?: string | null;
  type?: string | null;
  "type-id"?: string | null;
}

export interface MBRelation {
  type: string;
  "target-type": "artist" | "place" | "url" | "label";
  "target-credit"?: string;
  ended?: boolean;
  "attribute-values"?: Record<string, string>;
  artist?: MBRelationArtist;
  place?: MBRelationPlace;
  url?: { id: string; resource: string };
  label?: MBRelationLabel;
}

/** A page of events as returned by the MusicBrainz browse endpoint */
export interface MBEventList {
  events: MBEvent[];
  "event-count": number;
}

/** A raw event as returned by the MusicBrainz API and cached to disk */
export interface MBEvent {
  id: string;
  name: string;
  type?: string | null;
  "type-id"?: string | null;
  "life-span": {
    begin?: string | null;
    end?: string | null;
    ended: boolean;
  };
  time?: string;
  cancelled: boolean;
  disambiguation?: string;
  setlist?: string;
  relations?: MBRelation[];
  // Poster fields saved by the sync script
  posterUrl?: string; // Remote original URL
  posterThumb?: string; // Remote thumbnail URL
  imagePath?: string; // Local relative path
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

/** Event Art Archive poster metadata */
export interface EAAPosterInfo {
  images?: Array<{
    front: boolean;
    image: string;
    thumbnails?: Record<string, string>;
  }>;
}

export interface RawIzmirEvents {
  /** Bumped whenever the persisted format changes; stale caches are rejected */
  schemaVersion: number;
  events: MBEvent[];
  entities: Record<string, MBEntityLink[]>;
}

// Built at build time by preprocessors/events.ts — never saved to disk
export interface EnrichedIzmirEvents extends RawIzmirEvents {
  events: EnrichedMBEvent[];
  all: EnrichedMBEvent[];
  upcoming: EnrichedMBEvent[];
  past: EnrichedMBEvent[];
}

// ============================================================================
// POSTER DOWNLOADER
// ============================================================================

class PosterDownloader {
  private existingPosters = new Set<string>();

  async inventory() {
    this.existingPosters.clear();
    if (await exists(CONFIG.paths.posters)) {
      for await (const entry of Deno.readDir(CONFIG.paths.posters)) {
        if (entry.isFile) {
          this.existingPosters.add(entry.name);
        }
      }
    }
  }

  hasPoster(fileName: string): boolean {
    return this.existingPosters.has(fileName);
  }

  async download(
    httpClient: HttpClient,
    eventId: string,
    remoteUrl: string,
  ): Promise<string | null> {
    const extension = remoteUrl.split(".").pop()?.split(/[?#]/)[0] || "jpg";
    const fileName = `${eventId}.${extension}`;
    const localPath = join(CONFIG.paths.posters, fileName);
    const publicPath = `/assets/images/posters/${fileName}`;

    try {
      await ensureDir(CONFIG.paths.posters);

      // Check if already exists in inventory
      if (this.existingPosters.has(fileName)) {
        return publicPath;
      }

      console.log(`[mb_events] 📥 Downloading poster: ${eventId}`);
      // Image downloads are NOT rate limited by MusicBrainz
      const buffer = await httpClient.fetch<ArrayBuffer>(
        remoteUrl,
        "buffer",
        "force-cache",
        true,
      );

      if (buffer) {
        await Deno.writeFile(localPath, new Uint8Array(buffer));
        this.existingPosters.add(fileName);
        return publicPath;
      }
    } catch (err) {
      console.warn(
        `[mb_events] ⚠️ Failed to download poster for ${eventId}:`,
        err,
      );
    }
    return null;
  }
}

// ============================================================================
// SYNC LOGIC
// ============================================================================

async function fetchAllEvents(httpClient: HttpClient): Promise<MBEvent[]> {
  const events: MBEvent[] = [];
  const firstUrl = new URL(`${MB_API}/event`);
  firstUrl.searchParams.set("area", IZMIR_AREA_MBID);
  firstUrl.searchParams.set(
    "inc",
    "artist-rels+place-rels+url-rels+label-rels",
  );
  firstUrl.searchParams.set("fmt", "json");
  firstUrl.searchParams.set("limit", String(CONFIG.fetchLimit));
  firstUrl.searchParams.set("offset", "0");

  console.log(`[mb_events] 🌐 Fetching initial events...`);
  const firstData = await httpClient.fetch<unknown>(
    firstUrl.toString(),
    "json",
    "no-cache",
    true, // Bypassing rate limit for the main area browse (usually 1-2 pages)
  );

  if (!firstData) return [];
  const validated = validateOrThrow(MBEventListSchema, firstData);
  events.push(...(validated.events ?? []));
  const totalCount = validated["event-count"] ?? 0;

  if (totalCount > events.length) {
    const pages = [];
    for (
      let offset = events.length;
      offset < totalCount;
      offset += CONFIG.fetchLimit
    ) {
      const url = new URL(firstUrl.toString());
      url.searchParams.set("offset", String(offset));
      pages.push(
        httpClient.fetch<unknown>(url.toString(), "json", "no-cache", true),
      );
    }
    const results = await Promise.all(pages);
    results.forEach((data) => {
      if (data) events.push(...validateOrThrow(MBEventListSchema, data).events);
    });
  }

  return events;
}

async function fetchEventPosterInfo(
  httpClient: HttpClient,
  eventId: string,
): Promise<{ url?: string; thumb?: string }> {
  const url = `${EAA_API}/event/${eventId}/`;

  // EAA API calls are NOT rate limited like MusicBrainz
  const data = await httpClient.fetch<unknown>(
    url,
    "json",
    "force-cache",
    true,
  );

  const validated = validate(EAAPosterInfoSchema, data);
  if (!validated) return {};
  const frontImage = validated.images?.find((img) => img.front);

  if (frontImage) {
    return {
      url: frontImage.image,
      thumb: frontImage.thumbnails?.["500"] || frontImage.thumbnails?.["large"],
    };
  }
  return {};
}

async function fetchEntityDetails(
  httpClient: HttpClient,
  entityId: string,
  type: "artist" | "place" | "label" | "url",
): Promise<MBEntityLink[] | null> {
  const url = `${MB_API}/${type}/${entityId}?inc=url-rels&fmt=json`;
  // These MUST be rate limited as they hit MusicBrainz
  const data = await httpClient.fetch<unknown>(
    url,
    "json",
    "force-cache",
    false,
  );

  const validated = validate(EntityDetailsSchema, data);
  if (validated === null) return null;
  if (!validated.relations) return [];

  const links: MBEntityLink[] = [];
  validated.relations.forEach((rel) => {
    if (
      rel["target-type"] === "url" &&
      rel.url?.resource &&
      rel.ended !== true
    ) {
      links.push({ type: rel.type, url: rel.url.resource });
    }
  });

  return links;
}

async function syncEvents() {
  const httpClient = new HttpClient({
    userAgent: USER_AGENT,
    rateLimitMs: CONFIG.rateLimitDelayMs,
    cacheName: "mb-events-api-cache",
  });

  const posterDownloader = new PosterDownloader();
  await posterDownloader.inventory();

  const cachedData = await loadState<RawIzmirEvents>(
    CONFIG.paths.cacheFile,
    { schemaVersion: 1, events: [], entities: {} },
    RawIzmirEventsSchema,
  );
  const eventsMap = new Map(cachedData.events.map((e) => [e.id, e]));

  console.log("[mb_events] ℹ️ Starting MusicBrainz sync…");

  try {
    const raw = await fetchAllEvents(httpClient);

    if (raw.length === 0 && cachedData.events.length > 0) {
      console.warn(
        "[mb_events] ⚠️ Empty MusicBrainz response, keeping existing cache",
      );
      return;
    }

    const entityIds = new Map<string, "artist" | "place" | "label" | "url">();

    console.log(`[mb_events] 🖼️ Processing ${raw.length} event posters…`);

    const events = await Promise.all(
      raw.map(async (event: MBEvent) => {
        const cachedEvent = eventsMap.get(event.id);

        // Collect entity IDs for enrichment (always do this to ensure entities map is fresh)
        (event.relations || []).forEach((rel: MBRelation) => {
          if (rel["target-type"] === "artist" && rel.artist?.id) {
            entityIds.set(rel.artist.id, "artist");
          } else if (rel["target-type"] === "place" && rel.place?.id) {
            entityIds.set(rel.place.id, "place");
          } else if (rel["target-type"] === "url" && rel.url?.id) {
            entityIds.set(rel.url.id, "url");
          } else if (rel["target-type"] === "label" && rel.label?.id) {
            entityIds.set(rel.label.id, "label");
          }
        });

        // Sort relations for determinism
        if (event.relations) {
          event.relations.sort((a: MBRelation, b: MBRelation) => {
            const idA = a.artist?.id || a.place?.id || a.url?.id ||
              a.label?.id || "";
            const idB = b.artist?.id || b.place?.id || b.url?.id ||
              b.label?.id || "";
            return idA.localeCompare(idB) || a.type.localeCompare(b.type);
          });
        }

        // If we have it in cache AND the local image exists, skip expensive info fetch
        if (
          cachedEvent?.imagePath &&
          posterDownloader.hasPoster(
            cachedEvent.imagePath.split("/").pop() || "",
          )
        ) {
          return {
            ...event,
            posterUrl: cachedEvent.posterUrl,
            posterThumb: cachedEvent.posterThumb,
            imagePath: cachedEvent.imagePath,
          };
        }

        // Otherwise, fetch fresh poster info
        const posterInfo = await fetchEventPosterInfo(httpClient, event.id);
        let imagePath: string | undefined;

        if (posterInfo.url || posterInfo.thumb) {
          const imageUrl = posterInfo.thumb || posterInfo.url;
          if (imageUrl) {
            imagePath = (await posterDownloader.download(
              httpClient,
              event.id,
              imageUrl,
            )) || undefined;
          }
        }

        return {
          ...event,
          posterUrl: posterInfo.url,
          posterThumb: posterInfo.thumb,
          imagePath,
        };
      }),
    );

    // 4. Enrich entities (All links)
    const entities: Record<string, MBEntityLink[]> = {};
    console.log(
      `[mb_events] 🔍 Harvesting ${entityIds.size} unique entities…`,
    );

    const harvestResults = await Promise.all(
      Array.from(entityIds.entries()).map(async ([id, type]) => {
        if (id in cachedData.entities) {
          return [id, cachedData.entities[id]] as const;
        }

        const details = await fetchEntityDetails(httpClient, id, type);
        return [id, details] as const;
      }),
    );

    for (const [id, data] of harvestResults) {
      if (data) {
        // Sort links by URL for stability
        entities[id] = data.sort((a, b) => a.url.localeCompare(b.url));
      }
    }

    const newData = {
      schemaVersion: 1,
      events: events.sort((a, b) => a.id.localeCompare(b.id)),
      entities,
    };

    // Deep compare core data to avoid unnecessary writes
    const hasChanged = JSON.stringify(sortObjectKeys(newData)) !==
      JSON.stringify(sortObjectKeys(cachedData));

    if (hasChanged) {
      await saveState(CONFIG.paths.cacheFile, newData, RawIzmirEventsSchema);
      console.log(`[mb_events] ✅ Synced ${events.length} raw events.`);
    } else {
      console.log("[mb_events] ℹ️ No changes detected, skipping save.");
    }
  } catch (err) {
    console.error("[mb_events] ❌ Sync failed, using existing cache:", err);
  }
}

await syncEvents();
