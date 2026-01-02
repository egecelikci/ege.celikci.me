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

export interface Webmention {
  "wm-id": number;
  "wm-property": "like-of" | "repost-of" | "in-reply-to" | "mention-of";
  "wm-source": string;
  "wm-target": string;
  "wm-received": string;
  author?: {
    name: string;
    url?: string;
    photo?: string;
  };
  url?: string;
  published?: string;
  content?: {
    html?: string;
    text?: string;
    value?: string;
  };
}

export interface WebmentionFeed {
  children: Webmention[];
  lastFetched?: string | null;
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
