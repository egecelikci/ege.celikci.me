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
import { exists } from "@std/fs/exists";

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
  entities: Record<string, Array<{ type: string; url: string }>>;
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

async function fetchAllEvents(httpClient: HttpClient): Promise<any[]> {
  const events: any[] = [];
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
  const firstData = await httpClient.fetch<any>(
    firstUrl.toString(),
    "json",
    "no-cache",
    true, // Bypassing rate limit for the main area browse (usually 1-2 pages)
  );

  if (!firstData) return [];
  events.push(...(firstData.events ?? []));
  const totalCount = firstData["event-count"] ?? 0;

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
        httpClient.fetch<any>(url.toString(), "json", "no-cache", true),
      );
    }
    const results = await Promise.all(pages);
    results.forEach((data) => {
      if (data?.events) events.push(...data.events);
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
  const data = await httpClient.fetch<any>(url, "json", "force-cache", true);

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
): Promise<Array<{ type: string; url: string }>> {
  const url = `${MB_API}/${type}/${entityId}?inc=url-rels&fmt=json`;
  // These MUST be rate limited as they hit MusicBrainz
  const data = await httpClient.fetch<any>(url, "json", "force-cache", false);

  if (!data || !data.relations) return [];

  const links: Array<{ type: string; url: string }> = [];
  data.relations.forEach((rel: any) => {
    if (
      rel["target-type"] === "url" && rel.url?.resource && rel.ended !== true
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
    httpCacheDir: CONFIG.paths.httpCache,
  });

  const posterDownloader = new PosterDownloader();
  await posterDownloader.inventory();

  const cache = createCache<RawIzmirEvents>({
    filePath: CONFIG.paths.cacheFile,
    name: "mb_events",
  });

  const cachedData = await cache.load({
    events: [],
    entities: {},
    fetchedAt: "",
  });
  const eventsMap = new Map(cachedData.events.map((e) => [e.id, e]));

  console.log("[mb_events] ℹ️ Starting MusicBrainz sync...");

  try {
    const raw = await fetchAllEvents(httpClient);
    const now = new Date();

    const entityIds = new Map<string, "artist" | "place" | "label">();

    console.log(`[mb_events] 🖼️ Processing ${raw.length} event posters...`);

    const events = await Promise.all(raw.map(async (event) => {
      const cachedEvent = eventsMap.get(event.id);

      // Collect entity IDs for enrichment (always do this to ensure entities map is fresh)
      (event.relations || []).forEach((rel: any) => {
        if (rel["target-type"] === "artist" && rel.artist?.id) {
          entityIds.set(rel.artist.id, "artist");
        } else if (rel["target-type"] === "place" && rel.place?.id) {
          entityIds.set(rel.place.id, "place");
        } else if (rel["target-type"] === "label" && rel.label?.id) {
          entityIds.set(rel.label.id, "label");
        }
      });

      // If we have it in cache AND the local image exists, skip expensive info fetch
      if (
        cachedEvent?.imagePath &&
        posterDownloader.hasPoster(cachedEvent.imagePath.split("/").pop() || "")
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
          imagePath = await posterDownloader.download(
            httpClient,
            event.id,
            imageUrl,
          ) || undefined;
        }
      }

      return {
        ...event,
        posterUrl: posterInfo.url,
        posterThumb: posterInfo.thumb,
        imagePath,
      };
    }));

    // 4. Enrich entities (All links)
    const entities: Record<string, Array<{ type: string; url: string }>> = {};
    console.log(
      `[mb_events] 🔍 Harvesting ${entityIds.size} unique entities...`,
    );

    const harvestResults = await Promise.all(
      Array.from(entityIds.entries()).map(async ([id, type]) => {
        // If already in entities cache, skip
        if (cachedData.entities[id]) {
          return [id, cachedData.entities[id]] as const;
        }

        const details = await fetchEntityDetails(httpClient, id, type);
        return [id, details.length > 0 ? details : null] as const;
      }),
    );

    for (const [id, data] of harvestResults) {
      if (data) entities[id] = data;
    }

    const newData = {
      events: events.sort((a, b) => a.id.localeCompare(b.id)),
      entities,
    };

    // Deep compare core data (excluding fetchedAt) to avoid unnecessary writes
    // CacheManager.save will handle key sorting for the final file
    const hasChanged = JSON.stringify(cache.sortObjectKeys(newData)) !==
      JSON.stringify(
        cache.sortObjectKeys({
          events: cachedData.events,
          entities: cachedData.entities,
        }),
      );

    if (hasChanged) {
      await cache.save({
        ...newData,
        fetchedAt: now.toISOString(),
      });
      console.log(`[mb_events] ✅ Synced ${events.length} raw events.`);
    } else {
      console.log("[mb_events] ℹ️ No changes detected, skipping save.");
    }
  } catch (err) {
    console.error("[mb_events] ❌ Sync failed, using existing cache:", err);
  }
}

await syncEvents();
