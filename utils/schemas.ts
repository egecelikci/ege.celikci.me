/**
 * Zod schemas for the external data this site caches and renders, and the types derived from them.
 *
 * Every type here is `Model<typeof Schema>`, so the schema is the single definition: validation and types cannot drift apart.
 * Schemas use `.passthrough()` so unknown API fields survive into the cache; the types omit that catch-all, so a misspelled field name is a compile error.
 * @module
 */

import { z } from "zod";

/**
 * The fields a schema declares, without the catch-all index signature `.passthrough()` adds.
 *
 * Real records such as `Record<string, string>` keep their index signature, because only the `unknown` catch-all is removed.
 */
export type Declared<T> = T extends readonly (infer U)[] ? Declared<U>[]
  : T extends object ? {
      [
        K in keyof T as string extends K ? (unknown extends T[K] ? never : K)
          : K
      ]: Declared<T[K]>;
    }
  : T;

/** The declared type a schema validates to. */
export type Model<S extends z.ZodType> = Declared<z.output<S>>;

// MUSIC

const artistCreditSchema = z.object({
  name: z.string(),
  artist: z.object({ id: z.string(), name: z.string() }).passthrough(),
}).passthrough();

const albumBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  "first-release-date": z.string(),
  "artist-credit": z.array(artistCreditSchema),
}).passthrough();

const albumSchema = albumBaseSchema.extend({
  imagePath: z.string().optional(),
  imagePathMono: z.string().optional(),
  ratedAt: z.string().optional(),
}).passthrough();

export const ProcessedAlbumSchema = albumBaseSchema.extend({
  imagePath: z.string(),
  imagePathMono: z.string(),
  ratedAt: z.string(),
}).passthrough();

export const MusicStoreSchema = z.object({
  /** Bumped whenever the persisted format changes; stale caches are rejected. */
  schemaVersion: z.literal(2),
  albums: z.array(ProcessedAlbumSchema),
}).passthrough();

export type ArtistCredit = Model<typeof artistCreditSchema>;
export const AlbumSchema = albumSchema;
export type Album = Model<typeof albumSchema>;
/** An album whose cover images have been produced. */
export type ProcessedAlbum = Model<typeof ProcessedAlbumSchema>;
/** Persisted music cache shape (`src/_data/music.json`). */
export type MusicStore = Model<typeof MusicStoreSchema>;

const critiqueBrainzReviewSchema = z.object({
  entity_id: z.string(),
  entity_type: z.string(),
  rating: z.number(),
  created: z.string(),
}).passthrough();

export const CritiqueBrainzResponseSchema = z.object({
  reviews: z.array(critiqueBrainzReviewSchema),
  count: z.number(),
}).passthrough();

export type CritiqueBrainzReview = Model<typeof critiqueBrainzReviewSchema>;
export type CritiqueBrainzResponse = Model<
  typeof CritiqueBrainzResponseSchema
>;

// STEAM

const steamOwnedGameSchema = z.object({
  appid: z.number(),
  name: z.string(),
  playtime_forever: z.number(),
  playtime_2weeks: z.number().optional(),
  img_icon_url: z.string().optional(),
  img_logo_url: z.string().optional(),
  has_community_visible_stats: z.boolean().optional(),
}).passthrough();

/** Unwraps the `response` envelope of IPlayerService/GetOwnedGames. */
export const SteamOwnedGamesResponseSchema = z.object({
  response: z.object({
    game_count: z.number(),
    games: z.array(steamOwnedGameSchema).optional(),
  }).passthrough(),
}).passthrough().transform((envelope) => envelope.response);

const steamGameEntrySchema = z.object({
  appid: z.number(),
  name: z.string(),
}).passthrough();

export const GamesStoreSchema = z.object({
  /** Bumped whenever the persisted format changes; stale caches are rejected. */
  schemaVersion: z.literal(4),
  games: z.array(steamGameEntrySchema),
}).passthrough();

/** Raw game entry from IPlayerService/GetOwnedGames (include_appinfo=1). */
export type SteamOwnedGame = Model<typeof steamOwnedGameSchema>;
export type SteamOwnedGamesResponse = Model<
  typeof SteamOwnedGamesResponseSchema
>;
/** One game in the consolidated family library, keyed by appid. */
export type SteamGameEntry = Model<typeof steamGameEntrySchema>;
/** Persisted Steam cache shape (`src/_data/games.json`). */
export type GamesStore = Model<typeof GamesStoreSchema>;

// WEBMENTIONS

/** Author links and avatars come from strangers; anything but http(s) (`javascript:`, `data:`) is dropped rather than rendered. */
const webUrl = z.string().nullable().optional().transform((value) =>
  value && /^https?:\/\//i.test(value) ? value : null
);

export const WebmentionSchema = z.object({
  /** Unique ID from webmention.io. */
  "wm-id": z.number(),
  /** Type of webmention interaction. */
  "wm-property": z.enum(["like-of", "repost-of", "in-reply-to", "mention-of"]),
  /** Source URL where the mention originated. */
  "wm-source": z.string(),
  /** Target URL on your site that was mentioned. */
  "wm-target": z.string(),
  /** ISO timestamp when webmention.io received this mention. */
  "wm-received": z.string(),
  /** The person who sent the mention. */
  author: z.object({
    name: z.string(),
    type: z.string().optional(),
    url: webUrl,
    photo: webUrl,
  }).passthrough().nullable().optional(),
  /** Canonical URL of the source content. */
  url: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  /** ISO timestamp when the mention was published. */
  published: z.string().nullable().optional(),
  /** Content of the mention (for replies and mentions). */
  content: z.object({
    html: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  /** Private flag; a private mention must not be displayed publicly. */
  "wm-private": z.boolean().optional(),
  /** Top-level photo(s) of the source; jf2 may return a list. */
  photo: z.union([z.string(), z.array(z.string())]).nullable().optional(),
}).passthrough();

export const WebmentionFeedSchema = z.object({
  /** Bumped whenever the persisted format changes; stale caches are rejected. */
  schemaVersion: z.literal(1).default(1),
  /** Every stored webmention. */
  children: z.array(WebmentionSchema),
  /** ISO timestamp of the last successful fetch. */
  lastFetched: z.string().nullable(),
}).passthrough();

/** One webmention from webmention.io. */
export type Webmention = Model<typeof WebmentionSchema>;
/** Internal feed structure with metadata. */
export type WebmentionFeed = Model<typeof WebmentionFeedSchema>;

// MUSICBRAINZ EVENTS

const mbArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string(),
  disambiguation: z.string().optional(),
  country: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  "type-id": z.string().nullable().optional(),
}).passthrough();

const mbPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string().optional(),
  disambiguation: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).nullable().optional(),
  area: mbArtistSchema.optional(),
}).passthrough();

const mbLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string(),
  disambiguation: z.string().optional(),
  "label-code": z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  "type-id": z.string().nullable().optional(),
}).passthrough();

const mbRelationSchema = z.object({
  type: z.string(),
  "target-type": z.enum(["artist", "place", "url", "label"]),
  "target-credit": z.string().optional(),
  "attribute-values": z.record(z.string(), z.string()).optional(),
  artist: mbArtistSchema.optional(),
  place: mbPlaceSchema.optional(),
  url: z.object({ id: z.string(), resource: z.string() }).passthrough()
    .optional(),
  label: mbLabelSchema.optional(),
}).passthrough();

const mbEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().nullable().optional(),
  "type-id": z.string().nullable().optional(),
  "life-span": z.object({
    begin: z.string().nullable().optional(),
    end: z.string().nullable().optional(),
    ended: z.boolean(),
  }).passthrough(),
  time: z.string().optional(),
  cancelled: z.boolean(),
  disambiguation: z.string().optional(),
  setlist: z.string().optional(),
  relations: z.array(mbRelationSchema).optional(),
  /** Remote original poster URL saved by the sync script. */
  posterUrl: z.string().optional(),
  /** Remote thumbnail poster URL saved by the sync script. */
  posterThumb: z.string().optional(),
  /** Which Event Art Archive image the saved poster came from; absent on caches from before originals were saved. */
  posterSource: z.enum(["original", "thumb"]).optional(),
  /** Local relative poster path saved by the sync script. */
  imagePath: z.string().optional(),
}).passthrough();

export const MBEventListSchema = z.object({
  events: z.array(mbEventSchema),
  "event-count": z.number(),
}).passthrough();

export const EAAPosterInfoSchema = z.object({
  images: z.array(
    z.object({
      front: z.boolean(),
      image: z.string(),
      thumbnails: z.record(z.string(), z.string()).optional(),
    }).passthrough(),
  ).optional(),
}).passthrough();

export const RawIzmirEventsSchema = z.object({
  /** Bumped whenever the persisted format changes; stale caches are rejected. */
  schemaVersion: z.literal(1).default(1),
  events: z.array(mbEventSchema),
}).passthrough();

export type MBRelationArtist = Model<typeof mbArtistSchema>;
export type MBRelationPlace = Model<typeof mbPlaceSchema>;
export type MBRelationLabel = Model<typeof mbLabelSchema>;
export type MBRelation = Model<typeof mbRelationSchema>;
/** A raw event as returned by the MusicBrainz API and cached to disk. */
export type MBEvent = Model<typeof mbEventSchema>;
/** A page of events as returned by the MusicBrainz browse endpoint. */
export type MBEventList = Model<typeof MBEventListSchema>;
/** Event Art Archive poster metadata. */
export type EAAPosterInfo = Model<typeof EAAPosterInfoSchema>;
/** Persisted MusicBrainz event cache (`src/_data/mb_events.json`). */
export type RawIzmirEvents = Model<typeof RawIzmirEventsSchema>;

// VALIDATION

/**
 * Parse and validate data, returning null instead of throwing.
 *
 * @param schema - The schema to validate against.
 * @param data - Untrusted input.
 * @returns The declared type, or `null` when the data does not match.
 */
export function validate<S extends z.ZodType>(
  schema: S,
  data: unknown,
): Model<S> | null {
  const result = schema.safeParse(data);
  // The runtime value keeps its passthrough fields; the declared type simply does not name them.
  return result.success ? (result.data as Model<S>) : null;
}

/**
 * Parse and validate data, throwing on failure so callers can fall back.
 *
 * @param schema - The schema to validate against.
 * @param data - Untrusted input.
 * @returns The declared type.
 * @throws When the data does not match the schema.
 */
export function validateOrThrow<S extends z.ZodType>(
  schema: S,
  data: unknown,
): Model<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data as Model<S>;
}
