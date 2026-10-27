/**
 * Decides which Event Art Archive image an event poster should be saved from.
 * @module
 */

/** Where a saved poster came from. */
export type PosterSource = "original" | "thumb";

/** Poster URLs Event Art Archive reports for an event. */
export interface PosterInfo {
  url?: string;
  thumb?: string;
}

/** What the cache already knows about an event's poster. */
export interface CachedPoster {
  posterUrl?: string;
  posterSource?: PosterSource;
}

/** What to download for an event this run. */
export interface PosterPlan {
  /** Remote image to fetch, or undefined when Event Art Archive has none. */
  imageUrl?: string;
  /** Which kind of image `imageUrl` is. */
  source?: PosterSource;
  /** Re-download even when a file with this name already exists. */
  force: boolean;
}

/**
 * Plan the poster download for one event.
 *
 * The original is always preferred: the site's image plugins make the sized variants, so saving a thumbnail would cap quality for good. An event saved from a thumbnail before this rule is re-downloaded once, and only when an original exists to replace it.
 *
 * @param info - Poster URLs from Event Art Archive.
 * @param cached - The event's poster state from the previous sync.
 * @returns The URL to fetch, its kind, and whether to overwrite an existing file.
 * @example
 * posterPlan({ url: "o.jpg", thumb: "t.jpg" }, {}); // { imageUrl: "o.jpg", source: "original", force: true }
 */
export function posterPlan(
  info: PosterInfo,
  cached: CachedPoster = {},
): PosterPlan {
  if (info.url) {
    const changed = info.url !== cached.posterUrl;
    const upgrade = cached.posterSource !== "original";
    return {
      imageUrl: info.url,
      source: "original",
      force: changed || upgrade,
    };
  }
  if (info.thumb) {
    return {
      imageUrl: info.thumb,
      source: "thumb",
      force: false,
    };
  }
  return { force: false };
}

/**
 * Find an event's poster among the files on disk.
 *
 * Prefers the file the cache names; otherwise finds `<eventId>.<ext>` whatever the extension, so a cache that lost its path still reuses the file.
 *
 * @param names - Filenames in the posters folder.
 * @param eventId - MusicBrainz event id.
 * @param cachedFile - The filename the cache recorded, if any.
 * @returns The filename to use, or undefined when no poster is on disk.
 */
export function localPosterFile(
  names: string[],
  eventId: string,
  cachedFile?: string,
): string | undefined {
  if (cachedFile && names.includes(cachedFile)) return cachedFile;
  return names.find((name) => name.startsWith(`${eventId}.`));
}
