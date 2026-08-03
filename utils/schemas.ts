/**
 * utils/schemas.ts
 * Zod schemas for validating external API responses and cached state.
 *
 * Each schema is annotated with the interface it must satisfy, so a schema
 * that drifts from its interface fails at compile time. `.passthrough()`
 * keeps unknown API fields intact rather than stripping them.
 */

import { z } from "zod";
import type {
  EAAPosterInfo,
  MBEntityLink,
  MBEvent,
  MBEventList,
  MBRelation,
  MBRelationArtist,
  MBRelationLabel,
  MBRelationPlace,
  RawIzmirEvents,
} from "./fetch-events.ts";
import type {
  Album,
  CritiqueBrainzResponse,
  CritiqueBrainzReview,
  MusicStore,
  ProcessedAlbum,
  Webmention,
  WebmentionApiResponse,
  WebmentionFeed,
} from "../src/types/index.ts";

const entityLinkSchema: z.ZodType<MBEntityLink> = z.object({
  type: z.string(),
  url: z.string(),
}).passthrough();

const artistTargetSchema: z.ZodType<MBRelationArtist> = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string(),
  disambiguation: z.string().optional(),
  country: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  "type-id": z.string().nullable().optional(),
}).passthrough();

const placeTargetSchema: z.ZodType<MBRelationPlace> = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string().optional(),
  disambiguation: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).nullable().optional(),
  area: artistTargetSchema.optional(),
}).passthrough();

const labelTargetSchema: z.ZodType<MBRelationLabel> = z.object({
  id: z.string(),
  name: z.string(),
  "sort-name": z.string(),
  disambiguation: z.string().optional(),
  "label-code": z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  "type-id": z.string().nullable().optional(),
}).passthrough();

const relationSchema: z.ZodType<MBRelation> = z.object({
  type: z.string(),
  "target-type": z.enum(["artist", "place", "url", "label"]),
  "target-credit": z.string().optional(),
  ended: z.boolean().optional(),
  "attribute-values": z.record(z.string(), z.string()).optional(),
  artist: artistTargetSchema.optional(),
  place: placeTargetSchema.optional(),
  url: z.object({ id: z.string(), resource: z.string() }).passthrough()
    .optional(),
  label: labelTargetSchema.optional(),
}).passthrough();

const mbEventSchema: z.ZodType<MBEvent> = z.object({
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
  relations: z.array(relationSchema).optional(),
  posterUrl: z.string().optional(),
  posterThumb: z.string().optional(),
  imagePath: z.string().optional(),
}).passthrough();

export const MBEventListSchema: z.ZodType<MBEventList> = z.object({
  events: z.array(mbEventSchema),
  "event-count": z.number(),
}).passthrough();

export const EAAPosterInfoSchema: z.ZodType<EAAPosterInfo> = z.object({
  images: z.array(
    z.object({
      front: z.boolean(),
      image: z.string(),
      thumbnails: z.record(z.string(), z.string()).optional(),
    }).passthrough(),
  ).optional(),
}).passthrough();

export const EntityDetailsSchema: z.ZodType<{ relations?: MBRelation[] }> = z
  .object({
    relations: z.array(relationSchema).optional(),
  }).passthrough();

export const RawIzmirEventsSchema: z.ZodType<RawIzmirEvents> = z.object({
  schemaVersion: z.literal(1).default(1),
  events: z.array(mbEventSchema),
  entities: z.record(z.string(), z.array(entityLinkSchema)),
}).passthrough();

const webmentionSchema: z.ZodType<Webmention> = z.object({
  "wm-id": z.number(),
  "wm-property": z.enum(["like-of", "repost-of", "in-reply-to", "mention-of"]),
  "wm-source": z.string(),
  "wm-target": z.string(),
  "wm-received": z.string(),
  author: z.object({
    name: z.string(),
    type: z.string().optional(),
    url: z.string().nullable().optional(),
    photo: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  url: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  published: z.string().nullable().optional(),
  content: z.object({
    html: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  "wm-private": z.boolean().optional(),
  photo: z.union([z.string(), z.array(z.string())]).nullable().optional(),
}).passthrough();

export const WebmentionApiResponseSchema: z.ZodType<WebmentionApiResponse> = z
  .object({
    type: z.literal("feed"),
    children: z.array(webmentionSchema),
    name: z.string().optional(),
  }).passthrough();

export const WebmentionFeedSchema: z.ZodType<WebmentionFeed> = z.object({
  schemaVersion: z.literal(1).default(1),
  children: z.array(webmentionSchema),
  lastFetched: z.string().nullable(),
}).passthrough();

const critiqueBrainzReviewSchema: z.ZodType<CritiqueBrainzReview> = z.object({
  entity_id: z.string(),
  entity_type: z.string(),
  rating: z.number(),
  created: z.string(),
}).passthrough();

export const CritiqueBrainzResponseSchema: z.ZodType<CritiqueBrainzResponse> = z
  .object({
    reviews: z.array(critiqueBrainzReviewSchema),
    count: z.number(),
  }).passthrough();

const albumBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  "first-release-date": z.string(),
  "artist-credit": z.array(
    z.object({
      name: z.string(),
      artist: z.object({ id: z.string(), name: z.string() }).passthrough(),
    }).passthrough(),
  ),
}).passthrough();

export const AlbumSchema: z.ZodType<Album> = albumBaseSchema.extend({
  imagePath: z.string().optional(),
  imagePathMono: z.string().optional(),
  ratedAt: z.string().optional(),
}).passthrough();

export const ProcessedAlbumSchema: z.ZodType<ProcessedAlbum> = albumBaseSchema
  .extend({
    imagePath: z.string(),
    imagePathMono: z.string(),
    ratedAt: z.string(),
  }).passthrough();

export const MusicStoreSchema: z.ZodType<MusicStore> = z.object({
  schemaVersion: z.literal(2),
  albums: z.array(ProcessedAlbumSchema),
}).passthrough();

/** Parse and validate data, returning null instead of throwing. */
export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/** Parse and validate data, throwing on failure so callers can fall back. */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}
