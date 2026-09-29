import "lume/types.ts";
import type Searcher from "lume/core/searcher.ts";
import type {
  EnrichedIzmirEvents,
  EnrichedMBEvent,
  LocalEventData,
  MBRelationPlace,
} from "../utils/fetch-events.ts";
import type { PostImage } from "../utils/preprocessors/media.ts";
import type { WebmentionFeed } from "../src/types/index.ts";

/** A link a page declares: provenance, a related page, or syndication. */
export interface PageLink {
  label: string;
  url?: string;
  icon?: string;
  catalog?: string;
  /** how the link relates to the page, e.g. "taken at"; rendered inline */
  relation?: string;
}

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

export interface WebmentionStats {
  likes: number;
  reposts: number;
  replies: number;
}

export interface Backlink {
  url: string;
  title: string;
  /** date of the linking page; incoming list renders newest-first */
  date?: Date | string;
  /** icon for the linking page, from its kind */
  icon?: string;
  /** catalog the icon comes from */
  catalog?: string;
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
      updated?: Date;
      edited?: boolean;
      coverImage?: string;
      coverImageAlt?: string;
      metaImage?: string;
      links?: PageLink[];
      alternateFeeds?: Array<{ type: string; url: string; label: string }>;
      tag?: string;
      navigation?: { parent?: string };
      searchable?: boolean;
      noindex?: boolean;
      prose?: boolean;
      backlink?: Backlink;
      /** reverse link index built by utils/preprocessors/incoming.ts */
      backlinks?: Backlink[];
      /** the pages this one links to, same graph read forwards */
      outgoing?: Backlink[];
      openGraphLayout?: string | false;
    }
  }
}
