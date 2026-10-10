import { join } from "@std/path";
import { ensureDir } from "@std/fs/ensure-dir";
import { loadState, saveState, sortObjectKeys } from "./cache.ts";
import { HttpClient } from "./fetch-base.ts";
import { exists } from "@std/fs/exists";
import type {
  EAAPosterInfo,
  MBEvent,
  MBEventList,
  MBRelation,
  MBRelationArtist,
  MBRelationLabel,
  MBRelationPlace,
  RawIzmirEvents,
} from "./schemas.ts";

export type {
  EAAPosterInfo,
  MBEvent,
  MBEventList,
  MBRelation,
  MBRelationArtist,
  MBRelationLabel,
  MBRelationPlace,
  RawIzmirEvents,
};

import { localPosterFile, posterPlan } from "./posters.ts";
import {
  EAAPosterInfoSchema,
  MBEventListSchema,
  RawIzmirEventsSchema,
  validate,
  validateOrThrow,
} from "./schemas.ts";

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

/**
 * Downloads event posters and tracks the filenames already present on disk so unchanged posters are not re-fetched.
 */
class PosterDownloader {
  private existingPosters = new Set<string>();

  /** Rebuilds the set of poster filenames already present on disk. */
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

  /**
   * Public path of this event's poster if one is on disk, whatever its extension.
   * @param eventId - MusicBrainz event id.
   * @param cachedFile - The filename the cache recorded, if any.
   * @returns The public path, or undefined when no poster is on disk.
   */
  localPath(eventId: string, cachedFile?: string): string | undefined {
    const file = localPosterFile(
      [...this.existingPosters],
      eventId,
      cachedFile,
    );
    return file ? `/assets/images/posters/${file}` : undefined;
  }

  /**
   * Downloads a poster, or returns its public path when it already exists.
   * @param httpClient - HTTP client used for the download.
   * @param eventId - MusicBrainz event id, used as the filename stem.
   * @param remoteUrl - Remote poster URL to download.
   * @param force - Re-download even when a local file already exists.
   * @returns The public path, or null when the download fails.
   */
  async download(
    httpClient: HttpClient,
    eventId: string,
    remoteUrl: string,
    force = false,
  ): Promise<string | null> {
    const extension = remoteUrl.split(".").pop()?.split(/[?#]/)[0] || "jpg";
    const fileName = `${eventId}.${extension}`;
    const localPath = join(CONFIG.paths.posters, fileName);
    const publicPath = `/assets/images/posters/${fileName}`;

    try {
      await ensureDir(CONFIG.paths.posters);

      if (!force && this.existingPosters.has(fileName)) {
        return publicPath;
      }

      console.log(`[mb_events] 📥 Downloading poster: ${eventId}`);
      // no-cache: a forced re-download must reach the network. force-cache here would replay old bytes for an unchanged URL, so a replaced cover with a stable url never refreshed.
      const buffer = await httpClient.fetch<ArrayBuffer>(
        remoteUrl,
        "buffer",
        "no-cache",
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

/**
 * Fetches every İzmir-area event from MusicBrainz, following pagination.
 * @param httpClient - Rate-limited HTTP client.
 * @returns The raw events for all pages.
 */
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
  // MusicBrainz allows one request per second, so these go through the client's rate limiter.
  const firstData = await httpClient.fetch<unknown>(
    firstUrl.toString(),
    "json",
    "no-cache",
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
      pages.push(httpClient.fetch<unknown>(url.toString(), "json", "no-cache"));
    }
    const results = await Promise.all(pages);
    results.forEach((data, index) => {
      // A missing page would save a shorter list over the cache and drop events, so the whole sync gives up instead.
      if (!data) {
        throw new Error(
          `MusicBrainz page ${index + 2} failed; keeping the cache`,
        );
      }
      events.push(...validateOrThrow(MBEventListSchema, data).events);
    });
  }

  return events;
}

/**
 * Resolves the current front poster from the Event Art Archive. It is revalidated on every run because the front image can change, for example a corrected poster replacing one with a wrong date.
 * @param httpClient - HTTP client used for the request.
 * @param eventId - MusicBrainz event id.
 * @returns The original and thumbnail URLs, `{}` when the event has no front image, or `null` when Event Art Archive could not be reached. Callers must treat null as "unknown", not "no poster".
 */
async function fetchEventPosterInfo(
  httpClient: HttpClient,
  eventId: string,
): Promise<{ url?: string; thumb?: string } | null> {
  const url = `${EAA_API}/event/${eventId}/`;

  const data = await httpClient.fetch<unknown>(
    url,
    "json",
    "no-cache",
    true,
  );

  // EAA 5xx / timeout: leave the existing poster untouched.
  if (data === null) return null;

  const validated = validate(EAAPosterInfoSchema, data);
  if (!validated) return null;
  const frontImage = validated.images?.find((img) => img.front);

  if (frontImage) {
    return {
      url: frontImage.image,
      thumb: frontImage.thumbnails?.["500"] || frontImage.thumbnails?.["large"],
    };
  }
  return {};
}

/**
 * Syncs cached events and posters with MusicBrainz and the Event Art Archive, writing the result to the mb_events.json cache.
 */
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
    { schemaVersion: 1, events: [] },
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

    console.log(`[mb_events] 🖼️ Processing ${raw.length} event posters…`);

    const events = await Promise.all(
      raw.map(async (event: MBEvent) => {
        const cachedEvent = eventsMap.get(event.id);

        if (event.relations) {
          event.relations.sort((a: MBRelation, b: MBRelation) => {
            const idA = a.artist?.id || a.place?.id || a.url?.id ||
              a.label?.id || "";
            const idB = b.artist?.id || b.place?.id || b.url?.id ||
              b.label?.id || "";
            return idA.localeCompare(idB) || a.type.localeCompare(b.type);
          });
        }

        const posterInfo = await fetchEventPosterInfo(httpClient, event.id);

        // Event Art Archive is unreachable. Keep whatever poster we already cached instead of wiping it on a transient 5xx.
        if (posterInfo === null) {
          // Keep the poster already on disk, found by id even when the cache lost its path, and keep the record of where it came from.
          return {
            ...event,
            posterUrl: cachedEvent?.posterUrl,
            posterThumb: cachedEvent?.posterThumb,
            posterSource: cachedEvent?.posterSource,
            imagePath: posterDownloader.localPath(
              event.id,
              cachedEvent?.imagePath?.split("/").pop(),
            ),
          };
        }

        const plan = posterPlan(posterInfo, cachedEvent);
        let imagePath: string | undefined;
        let downloaded = true;

        if (plan.imageUrl) {
          const saved = await posterDownloader.download(
            httpClient,
            event.id,
            plan.imageUrl,
            plan.force,
          );
          downloaded = saved !== null;
          imagePath = saved || cachedEvent?.imagePath;
        }

        // When the new poster failed to download, keep the old URLs and source too, so the next run still sees a change and retries instead of trusting the stale file.
        return {
          ...event,
          posterUrl: downloaded ? posterInfo.url : cachedEvent?.posterUrl,
          posterThumb: downloaded ? posterInfo.thumb : cachedEvent?.posterThumb,
          posterSource: downloaded ? plan.source : cachedEvent?.posterSource,
          imagePath,
        };
      }),
    );

    const newData: RawIzmirEvents = {
      schemaVersion: 1,
      events: events.sort((a, b) => a.id.localeCompare(b.id)),
    };

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
