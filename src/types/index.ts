// src/types/index.ts

// ============================================================================
// MUSIC TYPES
// ============================================================================

export interface MusicBrainzArtist {
  id: string;
  name: string;
  "sort-name": string;
  disambiguation?: string;
  type?: string;
  "type-id"?: string;
  country?: string | null;
}

export interface ReleaseEvent {
  date?: string;
  area?: {
    id: string;
    name: string;
    "iso-3166-1-codes"?: string[];
  };
}

export interface ArtistCredit {
  name: string;
  artist: {
    id: string;
    name: string;
  };
}

export interface Release {
  id: string;
  title: string;
  date?: string;
  status?: string;
  "status-id"?: string;
  packaging?: string;
  "packaging-id"?: string;
  barcode?: string | null;
  disambiguation?: string;
  country?: string;
  quality?: string;
  "artist-credit": ArtistCredit[];
  "release-events"?: ReleaseEvent[];
  "text-representation"?: {
    language: string;
    script: string;
  };
}

export interface Album {
  id: string;
  title: string;
  "first-release-date": string;
  "artist-credit": ArtistCredit[];
  releases?: Release[];
  imagePath?: string;
  imagePathMono?: string;
}

export interface ProcessedAlbum extends Album {
  imagePath: string;
  imagePathMono: string;
}

export interface CritiqueBrainzReview {
  entity_id: string;
  entity_type: "release_group" | "recording";
  rating: number;
}

export interface CritiqueBrainzResponse {
  reviews: CritiqueBrainzReview[];
  count: number;
}

// ============================================================================
// WEBMENTION TYPES
// ============================================================================

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
    url?: string;
    photo?: string;
  };

  /** Canonical URL of the source content */
  url?: string;

  /** ISO timestamp when the mention was published */
  published?: string;

  /** Content of the mention (for replies and mentions) */
  content?: {
    html?: string;
    text?: string;
    value?: string;
  };

  /** Private flag (if set, should not be displayed publicly) */
  "wm-private"?: boolean;
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
  /** Array of all webmentions */
  children: Webmention[];

  /** ISO timestamp of last successful fetch */
  lastFetched: string | null;
}

/**
 * Webmentions grouped by target URL
 */
export interface WebmentionsByUrl {
  [targetUrl: string]: Webmention[];
}

/**
 * Webmentions grouped by type
 */
export interface WebmentionsByType {
  likes: Webmention[];
  reposts: Webmention[];
  replies: Webmention[];
  mentions: Webmention[];
}

/**
 * Statistics about webmentions
 */
export interface WebmentionStats {
  total: number;
  likes: number;
  reposts: number;
  replies: number;
  mentions: number;
}

// ============================================================================
// PAGE TYPES (Lume)
// ============================================================================

export type WikiStatus = "seedling" | "budding" | "evergreen";

export interface PageImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PageData {
  url: string;
  title: string;
  date?: Date;
  updated?: Date;
  description?: string;
  tags?: string[];
  status?: WikiStatus;
  type?: "post" | "note" | "entry" | "index";
  images?: PageImage[];
  content?: string;
  wordCount?: number;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface BadgeProps {
  text: string;
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
  icon?: string;
  classes?: string;
}

export interface CardProps {
  variant?: "default" | "elevated" | "flat";
  href?: string;
  hover?: boolean;
  padding?: string;
  classes?: string;
  content: string;
}

export interface NoteProps {
  note: PageData & {
    stats: {
      replies: number;
      reposts: number;
      likes: number;
    };
    syndication?: {
      bluesky?: string;
      mastodon?: string;
    };
  };
}
