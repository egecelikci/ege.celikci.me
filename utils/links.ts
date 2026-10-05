/**
 * Centralized mapping for external links to icons and labels.
 * Entries are pruned to what the content actually links to; a link with no mapping renders a generic icon and warns at build time, so add an entry when one shows up.
 */

export interface LinkMapping {
  icon: string;
  catalog: "lucide" | "simpleicons" | "remixicon";
  label: string;
  isFallback?: boolean;
}

/** Known fediverse (ActivityPub) instance hosts. Domains are arbitrary, so detection is an explicit allowlist—add new instances here. */
export const FEDIVERSE_HOSTS = [
  /** Gancio */
  "do.basspistol.org",
];

export const LINK_MAPPINGS: Record<string, LinkMapping> = {
  instagram: { icon: "instagram", catalog: "simpleicons", label: "Instagram" },
  lastdotfm: { icon: "lastdotfm", catalog: "simpleicons", label: "Last.fm" },
  setlistfm: { icon: "list-music", catalog: "lucide", label: "Setlist.fm" },
  wikidata: { icon: "wikidata", catalog: "simpleicons", label: "Wikidata" },
  "official homepage": {
    icon: "globe",
    catalog: "lucide",
    label: "Official Homepage",
  },
  ticketing: { icon: "ticket", catalog: "lucide", label: "Tickets" },
  poster: { icon: "image", catalog: "lucide", label: "Poster" },
  "social network": { icon: "users", catalog: "lucide", label: "Social" },
  "other databases": { icon: "database", catalog: "lucide", label: "Database" },
};

/**
 * Hostname (without scheme or leading "www.") to link mapping.
 * Takes priority over the type-based mapping.
 */
export const HOST_MAPPINGS: Record<string, LinkMapping> = {
  "instagram.com": LINK_MAPPINGS.instagram,
  "last.fm": LINK_MAPPINGS.lastdotfm,
  "setlist.fm": LINK_MAPPINGS.setlistfm,
  "wikidata.org": LINK_MAPPINGS.wikidata,
  "musicbrainz.org": {
    icon: "musicbrainz",
    catalog: "simpleicons",
    label: "MusicBrainz",
  },
  "store.steampowered.com": {
    icon: "steam",
    catalog: "simpleicons",
    label: "Steam",
  },
  "indieweb.org": {
    icon: "indieweb",
    catalog: "simpleicons",
    label: "IndieWeb",
  },
  "eventartarchive.org": {
    icon: "image",
    catalog: "lucide",
    label: "Event Art Archive",
  },
  "critiquebrainz.org": {
    icon: "music",
    catalog: "lucide",
    label: "CritiqueBrainz",
  },
};

const FEDIVERSE: LinkMapping = {
  icon: "fediverse-fill",
  catalog: "remixicon",
  label: "Fediverse",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Normalizes a URL and its type to a standard set of keys.
 * Resolution order: hostname match, fediverse allowlist, type match, fallback.
 */
export function getLinkInfo(type: string, url: string): LinkMapping {
  const typeLower = type.toLowerCase();

  const host = hostOf(url);
  if (host && HOST_MAPPINGS[host]) {
    return { ...HOST_MAPPINGS[host], isFallback: false };
  }

  if (host && FEDIVERSE_HOSTS.includes(host)) {
    return { ...FEDIVERSE, isFallback: false };
  }

  if (LINK_MAPPINGS[typeLower]) {
    return { ...LINK_MAPPINGS[typeLower], isFallback: false };
  }

  return {
    icon: "globe",
    catalog: "lucide",
    label: type,
    isFallback: true,
  };
}
