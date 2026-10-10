/**
 * Types for the external data the site caches and renders.
 *
 * They are derived from the zod schemas in `utils/schemas.ts`, which also validate that data, so the types cannot drift from the validation.
 * @module
 */

export type {
  Album,
  ArtistCredit,
  CritiqueBrainzResponse,
  CritiqueBrainzReview,
  GamesStore,
  MusicStore,
  ProcessedAlbum,
  SteamGameEntry,
  SteamOwnedGame,
  SteamOwnedGamesResponse,
  Webmention,
  WebmentionFeed,
} from "../../utils/schemas.ts";
