import media from "./preprocessors/media.ts";
import events from "./preprocessors/events.ts";
import feeds from "./preprocessors/feeds.ts";
import stats from "./preprocessors/stats.ts";
import dates from "./preprocessors/dates.ts";
import edited from "./preprocessors/edited.ts";

/**
 * Modular preprocessor registration.
 * Decouples logic for media, events, feeds, and statistics.
 */
export default function registerPreprocessors(site: Lume.Site) {
  site.use(media());
  site.use(events());
  site.use(feeds());
  site.use(stats());
  site.use(dates());
  site.use(edited());
}
