/**
 * utils/preprocessors/events.ts
 * Enriches MusicBrainz event data with local metadata and performers.
 * Pure logic lives in utils/events.ts for unit testing.
 */

import type { EnrichedMBEvent, MBRelation } from "../fetch-events.ts";
import {
  buildDisplayTitle,
  detectCustomTitle,
  extractArtists,
  filterLabels,
  isEventUpcoming,
  parseEventDate,
  resolveVenueName,
  sortByDate,
} from "../events.ts";

export default function () {
  return (site: Lume.Site) => {
    site.preprocess("*", (pages) => {
      const globalData = pages[0]?.data;
      if (!globalData?.mb_events) return;

      const { venues, events } = globalData;
      const mbEntities = globalData.mb_events.entities || {};
      const rawEvents = globalData.mb_events.events || [];

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const enrichEvent = (event: EnrichedMBEvent) => {
        if (event._enriched) return;

        // 1. Date Processing & Upcoming Status
        const beginDate = parseEventDate(event["life-span"]?.begin);
        const ended = event["life-span"]?.ended ?? false;

        event.beginDate = beginDate ? beginDate.toISOString() : null;
        event.isUpcoming = isEventUpcoming(
          beginDate,
          ended,
          event.cancelled,
          today,
        );

        // 2. Merge Venue overrides
        const venueRel = (event.relations || []).find((r: MBRelation) =>
          r["target-type"] === "place"
        );
        if (venueRel?.place?.id && venues?.[venueRel.place.id]) {
          venueRel.place = { ...venueRel.place, ...venues[venueRel.place.id] };
        }

        // 3. Merge local event data (price, instagram, etc.)
        const local = events?.[event.id] || {};
        event.local = local;

        // Merge setlist override
        if (local.setlist) {
          event.setlist = local.setlist;
        }

        // 4. Resolve Venue Name (Robust & Historical)
        // Priority: local override -> MB relation target-credit -> MB global name
        event.venueName = resolveVenueName(local, venueRel);

        // 5. Generate artists array and displayTitle
        // Filter out non-performer roles (posters, design, etc.)
        const artists = extractArtists(event.relations);
        event.artists = artists;

        event.displayTitle = buildDisplayTitle(
          artists,
          event.name,
          event.venueName,
        );

        // 6. Detect custom titles: Heuristic - if none of the artist names
        // appear verbatim in event.name, it's likely a real custom title.
        event.isCustomTitle = detectCustomTitle(event.name, artists);

        // 7. Label filtering
        const excludeLabels: string[] = local.exclude_labels ?? [];
        event.labels = filterLabels(event.relations, excludeLabels);

        // 8. Enrich relations with raw link data from global entities map
        (event.relations || []).forEach((rel: MBRelation) => {
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
      const upcoming = rawEvents.filter((e) => e.isUpcoming).sort(
        (a: EnrichedMBEvent, b: EnrichedMBEvent) => sortByDate(a, b),
      );
      const past = rawEvents.filter((e) => !e.isUpcoming).sort(
        (a: EnrichedMBEvent, b: EnrichedMBEvent) => sortByDate(a, b, true),
      );

      // Expose grouped lists to templates
      globalData.mb_events.all = rawEvents;
      globalData.mb_events.upcoming = upcoming;
      globalData.mb_events.past = past;

      // Crucially: Enrich page-level 'event' objects (for event_detail.page.ts)
      for (const page of pages) {
        if (page.data.event) {
          enrichEvent(page.data.event);
          const event = page.data.event;
          page.data.title = event.local?.title ||
            (event.isCustomTitle ? event.name : event.displayTitle);
        }
      }
    });
  };
}
