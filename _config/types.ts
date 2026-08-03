/**
 * _config/types.ts
 * Lume and Site-wide type augmentations.
 */

import "lume/types.ts";
import type Searcher from "lume/core/searcher.ts";
import type {
  EnrichedIzmirEvents,
  EnrichedMBEvent,
  LocalEventData,
  MBRelationPlace,
} from "../utils/fetch-events.ts";
import type { PostImage } from "../utils/preprocessors/images.ts";
import type { HeaderExtension } from "../utils/preprocessors/feeds.ts";
import type { WebmentionFeed } from "../src/types/index.ts";

export interface SiteData {
  site: {
    title: string;
    host: string;
    description: string;
    lang: string;
    locale: string;
    url: string;
  };
  author: {
    name: string;
    avatar: string;
    email: string;
    username: string;
    links: Array<{
      id: string;
      name: string;
      url: string;
      icon: string;
      label?: string;
      relMe?: boolean;
      keyUrl?: string;
      priority?: number;
    }>;
    social: {
      mastodon: { name: string; url: string };
      signal: { url: string };
      matrix: {
        username: string;
        homeserver: string;
        devices: Array<{ name: string; id: string }>;
      };
    };
  };
}

/** Webmention counts set by the stats preprocessor */
export interface WebmentionStats {
  likes: number;
  reposts: number;
  replies: number;
}

/** The `backlink` page data pointing to a previous entry */
export interface Backlink {
  url: string;
  title: string;
}

declare global {
  namespace Lume {
    export interface TypeConfig {
      strict: true;
    }

    export interface GlobalData extends SiteData {
      search: Searcher;
      mb_events: EnrichedIzmirEvents;
      events: Record<string, LocalEventData>;
      venues: Record<string, Partial<MBRelationPlace>>;
      stats?: WebmentionStats;
      webmentions?: WebmentionFeed;
      images?: PostImage[];
      title?: string;
      image?: string;
      event?: EnrichedMBEvent;
      description?: string;
      type?: string;
      updated?: string;
      coverImage?: string;
      coverImageAlt?: string;
      metaImage?: string;
      headerExtension?: HeaderExtension;
      alternateFeeds?: Array<{ type: string; url: string; label: string }>;
      tag?: string;
      navigation?: { parent?: string };
      searchable?: boolean;
      noindex?: boolean;
      prose?: boolean;
      backlink?: Backlink;
      openGraphLayout?: string | false;
    }
  }
}
