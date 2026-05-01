import * as path from "@std/path";
import type { Page, Site } from "lume/core.ts";
import { site as settings } from "../_config/metadata.ts";

function extractImagesFromNote(content: string) {
  const images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }> = [];

  // Support standard ![alt](src) and ![alt](src =WxH)
  const imgRegex =
    /!\[([^\]]*)\]\(([^)\s=]+)(?:\s+=(\d+)?x(\d+)?)?(?:\s+"([^"]+)")?\)/g;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const src = match[2];
    const width = match[3] ? parseInt(match[3], 10) : undefined;
    const height = match[4] ? parseInt(match[4], 10) : undefined;

    if (
      src.startsWith("/") || src.startsWith("http") ||
      /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(src)
    ) {
      images.push({
        alt: match[1] || "",
        src: src,
        width,
        height,
      });
    }
  }

  return images;
}

function normalizeUrl(url: string) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export default function registerPreprocessors(site: Site) {
  // Global data enrichment for MusicBrainz events
  site.preprocess("*", (pages: Page[]) => {
    const globalData = pages[0]?.data;
    if (!globalData?.mb_events) return;

    const { venues, events } = globalData;
    const mbEntities = globalData.mb_events.entities || {};
    const rawEvents = globalData.mb_events.events || [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const enrichEvent = (event: any) => {
      if (!event) return;
      if (event._enriched) return;

      // 1. Date Processing & Upcoming Status
      const beginStr = event["life-span"]?.begin;
      const ended = event["life-span"]?.ended ?? false;

      const beginDate: Date | null = (() => {
        if (!beginStr) return null;
        const d = new Date(beginStr);
        return isNaN(d.getTime()) ? null : d;
      })();

      event.beginDate = beginDate ? beginDate.toISOString() : null;
      event.isUpcoming = (beginDate ? beginDate >= today : !ended) &&
        !event.cancelled;

      // 2. Merge Venue overrides
      const venueRel = (event.relations || []).find((r: any) =>
        r["target-type"] === "place"
      );
      if (venueRel?.place?.id && venues?.[venueRel.place.id]) {
        venueRel.place = { ...venueRel.place, ...venues[venueRel.place.id] };
      }

      // 3. Merge local event data (price, instagram, etc.)
      const local = events?.[event.id] || {};
      event.local = local;

      // 4. Resolve Venue Name (Robust & Historical)
      // Priority: local override -> MB relation target-credit -> MB global name
      const venueName = local.venue_name || venueRel?.["target-credit"] ||
        venueRel?.place?.name;
      event.venueName = venueName;

      // 5. Generate artists array and displayTitle
      const artists = (event.relations || [])
        .filter((r: any) => r["target-type"] === "artist")
        .map((r: any) => r["target-credit"] || r.artist?.name)
        .filter(Boolean);

      let title = "";
      if (artists.length === 0) {
        title = event.name;
      } else {
        if (artists.length === 1) {
          title = artists[0];
        } else if (artists.length === 2) {
          title = artists.join(" & ");
        } else {
          const others = artists.slice(0, -1);
          const last = artists[artists.length - 1];
          title = `${others.join(", ")} & ${last}`;
        }
      }

      if (venueName) {
        title += ` @ ${venueName}`;
      }

      event.displayTitle = title;
      event.artists = artists;

      // 6. Detect custom titles: Heuristic - if none of the artist names
      // appear verbatim in event.name, it's likely a real custom title.
      const nameLower = event.name.toLowerCase();
      event.isCustomTitle = artists.length === 0
        ? Boolean(event.name)
        : !artists.some((a: string) => nameLower.includes(a.toLowerCase()));

      // 7. Label filtering
      const excludeLabels: string[] = local.exclude_labels ?? [];
      event.labels = (event.relations ?? [])
        .filter((r: any) =>
          r["target-type"] === "label" && !excludeLabels.includes(r.label?.id)
        );

      // 8. Enrich relations with Instagram links from global entities map
      // IMPORTANT: externalLinks on relation entities are applied by reference.
      // page.data.event.relations shares the same objects as globalData.mb_events.events[n].relations.
      // Any deep copy of page.data.event must include a subsequent call to enrichEntityLinks().
      (event.relations || []).forEach((rel: any) => {
        const entity = rel.artist || rel.place || rel.label;
        if (entity?.id && mbEntities[entity.id]) {
          entity.externalLinks = mbEntities[entity.id];
        }
      });

      event._enriched = true;
    };

    // Enrich all raw events
    rawEvents.forEach(enrichEvent);

    // Group and sort
    const sortByDate = (a: any, b: any, desc = false) => {
      const da = a.beginDate ? new Date(a.beginDate).getTime() : 0;
      const db = b.beginDate ? new Date(b.beginDate).getTime() : 0;
      return desc ? db - da : da - db;
    };

    const upcoming = rawEvents.filter((e: any) => e.isUpcoming).sort((
      a: any,
      b: any,
    ) => sortByDate(a, b));
    const past = rawEvents.filter((e: any) => !e.isUpcoming).sort((
      a: any,
      b: any,
    ) => sortByDate(a, b, true));

    // Expose grouped lists to templates
    globalData.mb_events.all = rawEvents;
    globalData.mb_events.upcoming = upcoming;
    globalData.mb_events.past = past;

    // Crucially: Enrich page-level 'event' objects (for event_detail.page.ts)
    for (const page of pages) {
      if (page.data.event) {
        enrichEvent(page.data.event);
      }
    }
  });

  site.preprocess([".md"], (pages: Page[]) => {
    for (const page of pages) {
      const pageUrl = page.data.url as string;
      if (!pageUrl) continue;

      const isNote = page.src.path.startsWith("/notes/") ||
        page.data.type === "note";
      const isPost = page.src.path.startsWith("/blog/") ||
        page.data.type === "post";

      // Extract images for notes and posts
      if ((isNote || isPost) && typeof page.data.content === "string") {
        const rawContent = page.data.content;
        const images = extractImagesFromNote(rawContent);

        if (images.length > 0) {
          page.data.images = images;
          const coverSrc = images[0]?.src;

          // Only set coverImage if not already explicitly set
          if (!page.data.coverImage) {
            page.data.coverImage = coverSrc;
            page.data.coverImageAlt = images[0]?.alt;
          }

          // Optimization: Use the -preview.jpg version for social media if it's a gallery image
          // and metaImage is not explicitly set
          if (
            coverSrc && coverSrc.includes("/gallery/") && !page.data.metaImage
          ) {
            page.data.metaImage = coverSrc.replace(
              /(\.[a-z]+)$/,
              "-preview.jpg",
            );
          }

          // For notes, we traditionally strip images from the content for the feed/listing
          if (isNote) {
            page.data.content = rawContent.replace(
              /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g,
              "",
            ).trim();
          }
        }
      }

      // Webmention stats logic
      const stats = { likes: 0, reposts: 0, replies: 0 };
      const webmentions = page.data.webmentions as any;

      if (webmentions?.children?.length) {
        const siteUrl = settings.url;
        const absPageUrl = normalizeUrl(siteUrl + pageUrl);

        const relevantMentions = webmentions.children.filter(
          (entry: any) => normalizeUrl(entry["wm-target"] || "") === absPageUrl,
        );

        stats.likes = relevantMentions.filter((m: any) =>
          m["wm-property"] === "like-of"
        ).length;
        stats.reposts = relevantMentions.filter((m: any) =>
          m["wm-property"] === "repost-of"
        ).length;
        stats.replies = relevantMentions.filter((m: any) =>
          ["mention-of", "in-reply-to"].includes(m["wm-property"])
        ).length;
      }

      page.data.stats = stats;
    }
  });
}
