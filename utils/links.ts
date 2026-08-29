/**
 * utils/links.ts
 * Centralized mapping for external links to icons and labels.
 */

export interface LinkMapping {
  icon: string;
  catalog: "lucide" | "simpleicons" | "remixicon";
  label: string;
  isFallback?: boolean;
}

/**
 * Known fediverse (ActivityPub) instance hosts. Domains are arbitrary,
 * so detection is an explicit allowlist — add new instances here.
 */
export const FEDIVERSE_HOSTS = [
  "do.basspistol.org", // Gancio
  "ieji.de", // Mastodon
  "mastodon.social",
  "mastodon.art",
  "kolektiva.social",
  "pixey.org",
  "ravenation.club",
  "cyberpunk.lol",
  "hachyderm.io",
  "fosstodon.org",
];

export const LINK_MAPPINGS: Record<string, LinkMapping> = {
  instagram: { icon: "instagram", catalog: "simpleicons", label: "Instagram" },
  facebook: { icon: "facebook", catalog: "simpleicons", label: "Facebook" },
  youtube: { icon: "youtube", catalog: "simpleicons", label: "YouTube" },
  "youtube music": {
    icon: "youtubemusic",
    catalog: "simpleicons",
    label: "YouTube Music",
  },
  twitter: { icon: "twitter", catalog: "simpleicons", label: "Twitter" },
  tiktok: { icon: "tiktok", catalog: "simpleicons", label: "TikTok" },
  bandcamp: { icon: "bandcamp", catalog: "simpleicons", label: "Bandcamp" },
  soundcloud: {
    icon: "soundcloud",
    catalog: "simpleicons",
    label: "SoundCloud",
  },
  spotify: { icon: "spotify", catalog: "simpleicons", label: "Spotify" },
  deezer: { icon: "deezer", catalog: "simpleicons", label: "Deezer" },
  tidal: { icon: "tidal", catalog: "simpleicons", label: "TIDAL" },
  applemusic: {
    icon: "applemusic",
    catalog: "simpleicons",
    label: "Apple Music",
  },
  "amazon music": {
    icon: "amazonmusic",
    catalog: "simpleicons",
    label: "Amazon Music",
  },
  napster: { icon: "napster", catalog: "simpleicons", label: "Napster" },
  discogs: { icon: "discogs", catalog: "simpleicons", label: "Discogs" },
  songkick: { icon: "songkick", catalog: "simpleicons", label: "Songkick" },
  myspace: { icon: "myspace", catalog: "simpleicons", label: "MySpace" },
  genius: { icon: "genius", catalog: "simpleicons", label: "Genius" },
  wikidata: { icon: "wikidata", catalog: "simpleicons", label: "Wikidata" },
  wikipedia: { icon: "wikipedia", catalog: "simpleicons", label: "Wikipedia" },
  imdb: { icon: "imdb", catalog: "simpleicons", label: "IMDb" },
  bandsintown: {
    icon: "bandsintown",
    catalog: "simpleicons",
    label: "Bandsintown",
  },
  vimeo: { icon: "vimeo", catalog: "simpleicons", label: "Vimeo" },
  discord: { icon: "discord", catalog: "simpleicons", label: "Discord" },
  lastdotfm: { icon: "lastdotfm", catalog: "simpleicons", label: "Last.fm" },
  setlistfm: {
    icon: "list-music",
    catalog: "lucide",
    label: "Setlist.fm",
  },
  homepage: { icon: "globe", catalog: "lucide", label: "Official Homepage" },
  "official site": {
    icon: "globe",
    catalog: "lucide",
    label: "Official Homepage",
  },
  "official homepage": {
    icon: "globe",
    catalog: "lucide",
    label: "Official Homepage",
  },
  ticketing: { icon: "ticket", catalog: "lucide", label: "Tickets" },
  poster: { icon: "image", catalog: "lucide", label: "Poster" },
  "social network": { icon: "users", catalog: "lucide", label: "Social" },
  "free streaming": { icon: "radio", catalog: "lucide", label: "Streaming" },
  streaming: { icon: "radio", catalog: "lucide", label: "Streaming" },
  "purchase for download": {
    icon: "download",
    catalog: "lucide",
    label: "Download",
  },
  "other databases": { icon: "database", catalog: "lucide", label: "Database" },
  image: { icon: "image", catalog: "lucide", label: "Image" },
  lyrics: { icon: "file-text", catalog: "lucide", label: "Lyrics" },
  blog: { icon: "newspaper", catalog: "lucide", label: "Blog" },
  fanpage: { icon: "heart", catalog: "lucide", label: "Fan page" },
  "video channel": { icon: "video", catalog: "lucide", label: "Video" },
  VIAF: { icon: "landmark", catalog: "lucide", label: "VIAF" },
  allmusic: { icon: "music", catalog: "lucide", label: "AllMusic" },
  lastfm: { icon: "lastdotfm", catalog: "simpleicons", label: "Last.fm" },
};

/**
 * Hostname (without scheme or leading "www.") to link mapping.
 * Takes priority over the type-based mapping.
 */
export const HOST_MAPPINGS: Record<string, LinkMapping> = {
  "instagram.com": LINK_MAPPINGS.instagram,
  "facebook.com": LINK_MAPPINGS.facebook,
  "youtube.com": LINK_MAPPINGS.youtube,
  "music.youtube.com": LINK_MAPPINGS["youtube music"],
  "x.com": LINK_MAPPINGS.twitter,
  "twitter.com": LINK_MAPPINGS.twitter,
  "tiktok.com": LINK_MAPPINGS.tiktok,
  "open.spotify.com": LINK_MAPPINGS.spotify,
  "music.apple.com": LINK_MAPPINGS.applemusic,
  "itunes.apple.com": LINK_MAPPINGS.applemusic,
  "deezer.com": LINK_MAPPINGS.deezer,
  "tidal.com": LINK_MAPPINGS.tidal,
  "soundcloud.com": LINK_MAPPINGS.soundcloud,
  "bandcamp.com": LINK_MAPPINGS.bandcamp,
  "discogs.com": LINK_MAPPINGS.discogs,
  "songkick.com": LINK_MAPPINGS.songkick,
  "myspace.com": LINK_MAPPINGS.myspace,
  "last.fm": LINK_MAPPINGS.lastdotfm,
  "setlist.fm": LINK_MAPPINGS.setlistfm,
  "vimeo.com": LINK_MAPPINGS.vimeo,
  "discord.gg": LINK_MAPPINGS.discord,
  "genius.com": LINK_MAPPINGS.genius,
  "wikidata.org": LINK_MAPPINGS.wikidata,
  "wikipedia.org": LINK_MAPPINGS.wikipedia,
  "web.napster.com": LINK_MAPPINGS.napster,
  "us.napster.com": LINK_MAPPINGS.napster,
  "music.amazon.com": LINK_MAPPINGS["amazon music"],
  "imdb.com": LINK_MAPPINGS.imdb,
  "bandsintown.com": LINK_MAPPINGS.bandsintown,
};

const FEDIVERSE: LinkMapping = {
  icon: "fediverse-fill",
  catalog: "remixicon",
  label: "Fediverse",
};

/**
 * Display priority for the quick strip: most valuable platforms first.
 * Unknown labels sort last.
 */
const PRIORITY: Record<string, number> = {};
[
  "Official Homepage",
  "Spotify",
  "Apple Music",
  "Instagram",
  "Bandcamp",
  "SoundCloud",
  "YouTube",
  "Deezer",
  "TIDAL",
  "Twitter",
  "Fediverse",
  "YouTube Music",
  "Discogs",
  "Songkick",
  "Last.fm",
  "Setlist.fm",
  "Amazon Music",
  "Napster",
  "MySpace",
  "Genius",
  "TikTok",
  "Vimeo",
  "Facebook",
  "Bandsintown",
  "Wikipedia",
  "Wikidata",
  "IMDb",
  "Discord",
  "AllMusic",
  "VIAF",
  "Image",
  "Social",
  "Streaming",
  "Download",
  "Database",
  "Lyrics",
  "Blog",
  "Fan page",
  "Video",
  "Tickets",
  "Poster",
].forEach((label, i) => PRIORITY[label] = i);

export function linkPriority(label: string): number {
  return PRIORITY[label] ?? 999;
}

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
