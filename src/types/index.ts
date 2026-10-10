// MUSIC TYPES

export interface ArtistCredit {
  name: string;
  artist: {
    id: string;
    name: string;
  };
}

export interface Album {
  id: string;
  title: string;
  "first-release-date": string;
  "artist-credit": ArtistCredit[];
  imagePath?: string;
  imagePathMono?: string;
  ratedAt?: string;
}

export interface ProcessedAlbum extends Album {
  imagePath: string;
  imagePathMono: string;
  ratedAt: string;
}

/** Persisted music cache shape (src/_data/music.json) */
export interface MusicStore {
  /** Bumped whenever the persisted format changes; stale caches are rejected */
  schemaVersion: number;
  albums: ProcessedAlbum[];
}

export interface CritiqueBrainzReview {
  entity_id: string;
  entity_type: string;
  rating: number;
  created: string;
}

export interface CritiqueBrainzResponse {
  reviews: CritiqueBrainzReview[];
  count: number;
}

// STEAM TYPES

/** Raw game entry from IPlayerService/GetOwnedGames (include_appinfo=1) */
export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
}

export interface SteamOwnedGamesResponse {
  game_count: number;
  games?: SteamOwnedGame[];
}

/** One game in the consolidated family library, keyed by appid */
export interface SteamGameEntry {
  appid: number;
  name: string;
}

/** Persisted Steam cache shape (src/_data/games.json) */
export interface GamesStore {
  /** Bumped whenever the persisted format changes; stale caches are rejected */
  schemaVersion: number;
  games: SteamGameEntry[];
}

// WEBMENTION TYPES

/**
 * Individual webmention entry
 */
export interface Webmention {
  /** Unique ID from webmention.io */
  "wm-id": number;

  /** Type of webmention interaction */
  "wm-property": "like-of" | "repost-of" | "in-reply-to" | "mention-of";

  /** Source URL where the mention originated */
  "wm-source": string;

  /** Target URL on your site that was mentioned */
  "wm-target": string;

  /** ISO timestamp when webmention.io received this mention */
  "wm-received": string;

  /** Information about the person who sent the mention */
  author?: {
    name: string;
    type?: string;
    url?: string | null;
    photo?: string | null;
  } | null;

  /** Canonical URL of the source content */
  url?: string | string[] | null;

  /** ISO timestamp when the mention was published */
  published?: string | null;

  /** Content of the mention (for replies and mentions) */
  content?: {
    html?: string | null;
    text?: string | null;
    value?: string | null;
  } | null;

  /** Private flag (if set, should not be displayed publicly) */
  "wm-private"?: boolean;

  /** Top-level photo(s) of the source (jf2 may return a list) */
  photo?: string | string[] | null;
}

/**
 * Response from webmention.io API
 */
export interface WebmentionApiResponse {
  /** Type identifier for the response format */
  type: "feed";

  /** Array of webmention entries */
  children: Webmention[];

  /** Optional: Name of the feed */
  name?: string;
}

/**
 * Internal feed structure with metadata
 */
export interface WebmentionFeed {
  /** Bumped whenever the persisted format changes; stale caches are rejected */
  schemaVersion: number;

  /** Array of all webmentions */
  children: Webmention[];

  /** ISO timestamp of last successful fetch */
  lastFetched: string | null;
}
