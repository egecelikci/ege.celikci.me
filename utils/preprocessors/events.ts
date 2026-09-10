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

      const { events } = globalData;
      const mbEntities = globalData.mb_events.entities || {};
      const rawEvents = globalData.mb_events.events || [];

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const enrichEvent = (event: EnrichedMBEvent) => {
        if (event._enriched) return;

        const beginDate = parseEventDate(event["life-span"]?.begin);
        const ended = event["life-span"]?.ended ?? false;

        event.beginDate = beginDate ? beginDate.toISOString() : null;
        event.isUpcoming = isEventUpcoming(
          beginDate,
          ended,
          event.cancelled,
          today,
        );

        const local = events?.[event.id] || {};
        event.local = local;

        if (local.setlist) {
          event.setlist = local.setlist;
        }

        const venueRel = (event.relations || []).find((r: MBRelation) =>
          r["target-type"] === "place"
        );
        event.venueName = resolveVenueName(local, venueRel);

        const artists = extractArtists(event.relations);
        event.artists = artists;

        event.displayTitle = buildDisplayTitle(
          artists,
          event.name,
          event.venueName,
        );

        event.isCustomTitle = detectCustomTitle(event.name, artists);

        const excludeLabels: string[] = local.exclude_labels ?? [];
        event.labels = filterLabels(event.relations, excludeLabels);

        (event.relations || []).forEach((rel: MBRelation) => {
          const entity = rel.artist || rel.place || rel.label;
          if (entity?.id && mbEntities[entity.id]) {
            entity.externalLinks = mbEntities[entity.id];
          }
        });

        event._enriched = true;
      };

      rawEvents.forEach(enrichEvent);

      const upcoming = rawEvents.filter((e) => e.isUpcoming).sort(
        (a: EnrichedMBEvent, b: EnrichedMBEvent) => sortByDate(a, b),
      );
      const past = rawEvents.filter((e) => !e.isUpcoming).sort(
        (a: EnrichedMBEvent, b: EnrichedMBEvent) => sortByDate(a, b, true),
      );

      globalData.mb_events.all = rawEvents;
      globalData.mb_events.upcoming = upcoming;
      globalData.mb_events.past = past;

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
