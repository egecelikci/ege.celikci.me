/**
 * utils/preprocessors/events.ts
 * Enriches MusicBrainz event data with local metadata and performers.
 */

import type { Page, Site } from "lume/core.ts";

export default function () {
  return (site: Site) => {
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
        // Filter out non-performer roles (posters, design, etc.)
        const nonPerformerRoles = [
          "illustration",
          "graphic design",
          "artwork",
          "design",
          "engineer",
        ];
        const artists = (event.relations || [])
          .filter((r: any) =>
            r["target-type"] === "artist" && !nonPerformerRoles.includes(r.type)
          )
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
        const pageUrl = page.data.url as string;
        if (!pageUrl) continue;

        if (page.data.event) {
          enrichEvent(page.data.event);
          // Sync page title with enriched event title (filtering non-performers)
          page.data.title = page.data.event.displayTitle;
        }
      }
    });
  };
}
