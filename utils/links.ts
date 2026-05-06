/**
 * utils/links.ts
 * Centralized mapping for external links to icons and labels.
 */

export interface LinkMapping {
  icon: string;
  catalog: "lucide" | "simpleicons";
  label: string;
  isFallback?: boolean;
}

export const LINK_MAPPINGS: Record<string, LinkMapping> = {
  instagram: { icon: "instagram", catalog: "simpleicons", label: "Instagram" },
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
  facebook: { icon: "facebook", catalog: "simpleicons", label: "Facebook" },
  youtube: { icon: "youtube", catalog: "simpleicons", label: "YouTube" },
  bandcamp: { icon: "bandcamp", catalog: "simpleicons", label: "Bandcamp" },
  soundcloud: {
    icon: "soundcloud",
    catalog: "simpleicons",
    label: "SoundCloud",
  },
  ticketing: { icon: "ticket", catalog: "lucide", label: "Tickets" },
};

/**
 * Normalizes a URL and its type to a standard set of keys.
 */
export function getLinkInfo(type: string, url: string): LinkMapping {
  const typeLower = type.toLowerCase();

  // 1. Direct type match
  if (LINK_MAPPINGS[typeLower]) {
    return { ...LINK_MAPPINGS[typeLower], isFallback: false };
  }

  // 2. Heuristic based on URL
  if (url.includes("instagram.com")) {
    return { ...LINK_MAPPINGS.instagram, isFallback: false };
  }
  if (url.includes("facebook.com")) {
    return { ...LINK_MAPPINGS.facebook, isFallback: false };
  }
  if (url.includes("youtube.com")) {
    return { ...LINK_MAPPINGS.youtube, isFallback: false };
  }
  if (url.includes("bandcamp.com")) {
    return { ...LINK_MAPPINGS.bandcamp, isFallback: false };
  }
  if (url.includes("soundcloud.com")) {
    return { ...LINK_MAPPINGS.soundcloud, isFallback: false };
  }

  // Default
  return {
    icon: "globe",
    catalog: "lucide",
    label: type,
    isFallback: true,
  };
}
