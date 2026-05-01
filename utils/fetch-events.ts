/**
 * src/utils/fetch-events.ts
 *
 * Fetches and caches MusicBrainz events for the İzmir area.
 * Saves results to src/_data/mb_events.json for Lume to pick up.
 * Downloads event posters locally for archival and reliability.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { createCache } from "./cache.ts";
import { HttpClient } from "./fetch-base.ts";

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
    httpCache: join(Deno.cwd(), "_cache", "http-cache"),
    posters: "src/assets/images/posters",
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface MBRelation {
  type: string;
  "target-type": "artist" | "place" | "url" | "label";
  "target-credit"?: string;
  artist?: { id: string; name: string; "sort-name": string };
  place?: {
    id: string;
    name: string;
    address?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  url?: { id: string; resource: string };
  label?: { id: string; name: string; "sort-name": string };
}

export interface MBEvent {
  id: string;
  name: string;
  type?: string;
  "type-id"?: string;
  "life-span": {
    begin?: string;
    end?: string;
    ended: boolean;
  };
  time?: string;
  cancelled: boolean;
  disambiguation?: string;
  relations?: MBRelation[];
  // Derived fields
  beginDate: string | null;
  isUpcoming: boolean;
  posterUrl?: string; // Remote original URL
  posterThumb?: string; // Remote thumbnail URL
  imagePath?: string; // Local relative path
  isCustomTitle?: boolean; // Set by preprocessor
}

export interface RawIzmirEvents {
  events: MBEvent[];
  entities: Record<string, { instagram?: string }>;
  fetchedAt: string;
}

// Derived at build time by preprocessors.ts — never saved to disk
export interface EnrichedIzmirEvents extends RawIzmirEvents {
  upcoming: MBEvent[];
  past: MBEvent[];
  all: MBEvent[];
}

// ============================================================================
// POSTER DOWNLOADER
// ============================================================================

class PosterDownloader {
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

      // Check if already exists
      try {
        await Deno.stat(localPath);
        return publicPath;
      } catch {
        // Not found, continue to download
      }

      console.log(`[mb_events] 📥 Downloading poster: ${eventId}`);
      const buffer = await httpClient.fetch<ArrayBuffer>(
        remoteUrl,
        "buffer",
        "force-cache",
      );

      if (buffer) {
        await Deno.writeFile(localPath, new Uint8Array(buffer));
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

async function fetchAllEvents(httpClient: HttpClient): Promise<any[]> {
  const events: any[] = [];
  let offset = 0;
  let totalCount = Infinity;

  while (events.length < totalCount) {
    const url = new URL(`${MB_API}/event`);
    url.searchParams.set("area", IZMIR_AREA_MBID);
    url.searchParams.set("inc", "artist-rels+place-rels+url-rels+label-rels");
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", String(CONFIG.fetchLimit));
    url.searchParams.set("offset", String(offset));

    console.log(`[mb_events] 🌐 Fetching offset ${offset}...`);
    const data = await httpClient.fetch<any>(
      url.toString(),
      "json",
      "no-cache",
      true,
    );

    if (!data) break;
    totalCount = data["event-count"] ?? 0;

    const page: any[] = data.events ?? [];
    if (page.length === 0) break;

    events.push(...page);
    offset += page.length;
  }

  return events;
}

async function fetchEventPosterInfo(
  httpClient: HttpClient,
  eventId: string,
): Promise<{ url?: string; thumb?: string }> {
  const url = `${EAA_API}/event/${eventId}/`;

  // Optimization: check cache first to avoid rate limit wait
  const cached = await httpClient.getCachedJson<any>(url);
  const data = cached ||
    await httpClient.fetch<any>(url, "json", "force-cache");

  if (!data) return {};
  const frontImage = data.images?.find((img: any) => img.front);

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
  type: "artist" | "place" | "label",
): Promise<{ instagram?: string }> {
  const url = `${MB_API}/${type}/${entityId}?inc=url-rels&fmt=json`;
  const data = await httpClient.fetch<any>(url, "json", "force-cache");

  if (!data) return {};

  const igRel = data.relations?.find((r: any) =>
    (r.type === "social network" || r.type === "instagram") &&
    r.url?.resource?.includes("instagram.com")
  );

  return {
    instagram: igRel?.url?.resource,
  };
}

async function syncEvents() {
  const httpClient = new HttpClient({
    userAgent: USER_AGENT,
    rateLimitMs: CONFIG.rateLimitDelayMs,
    httpCacheDir: CONFIG.paths.httpCache,
  });

  const posterDownloader = new PosterDownloader();

  const cache = createCache<RawIzmirEvents>({
    filePath: CONFIG.paths.cacheFile,
    name: "mb_events",
  });

  console.log("[mb_events] ℹ️ Starting MusicBrainz sync...");

  try {
    const raw = await fetchAllEvents(httpClient);
    const now = new Date();

    const events: any[] = [];
    const entityIds = new Map<string, "artist" | "place" | "label">();

    for (const event of raw) {
      // 1. Poster processing (Archival side effect)
      const url = `${EAA_API}/event/${event.id}/`;
      const cachedPosterInfo = await httpClient.getCachedJson<any>(url);
      if (cachedPosterInfo) {
        console.log(`[mb_events] ⚡️ Cache hit for poster info: ${event.id}`);
      }

      const posterInfo = await fetchEventPosterInfo(httpClient, event.id);
      let imagePath: string | undefined;

      if (posterInfo.url || posterInfo.thumb) {
        const imageUrl = posterInfo.thumb || posterInfo.url;
        if (imageUrl) {
          const localUrl = await posterDownloader.download(
            httpClient,
            event.id,
            imageUrl,
          );
          if (localUrl) imagePath = localUrl;
        }
      }

      // 2. Collect entity IDs for enrichment
      (event.relations || []).forEach((rel: any) => {
        if (rel["target-type"] === "artist" && rel.artist?.id) {
          entityIds.set(rel.artist.id, "artist");
        } else if (rel["target-type"] === "place" && rel.place?.id) {
          entityIds.set(rel.place.id, "place");
        } else if (rel["target-type"] === "label" && rel.label?.id) {
          entityIds.set(rel.label.id, "label");
        }
      });

      // 3. Attach metadata to raw object
      events.push({
        ...event,
        posterUrl: posterInfo.url,
        posterThumb: posterInfo.thumb,
        imagePath,
      });
    }

    // 4. Enrich entities (IG links)
    const entities: Record<string, { instagram?: string }> = {};
    console.log(
      `[mb_events] 🔍 Harvesting ${entityIds.size} unique entities...`,
    );

    for (const [id, type] of entityIds) {
      const mbUrl = `${MB_API}/${type}/${id}?inc=url-rels&fmt=json`;
      const cached = await httpClient.getCachedJson<any>(mbUrl);

      if (cached !== null) {
        // Hot path: extract from cache immediately
        console.log(`[mb_events] ⚡️ Cache hit for ${type}: ${id}`);
        const igRel = (cached.relations || []).find((r: any) =>
          (r.type === "social network" || r.type === "instagram") &&
          r.url?.resource?.includes("instagram.com")
        );
        if (igRel?.url?.resource) {
          entities[id] = { instagram: igRel.url.resource };
        }
      } else {
        // Cold path: rate limited network call
        console.log(`[mb_events] 🌐 Cache miss for ${type}: ${id}`);
        const details = await fetchEntityDetails(httpClient, id, type);
        if (details.instagram) {
          entities[id] = details;
        }
      }
    }

    const finalData: RawIzmirEvents = {
      events,
      entities,
      fetchedAt: now.toISOString(),
    };

    await cache.save(finalData);
    console.log(
      `[mb_events] ✅ Synced ${events.length} raw events.`,
    );
  } catch (err) {
    console.error("[mb_events] ❌ Sync failed, using existing cache:", err);
  }
}

await syncEvents();
