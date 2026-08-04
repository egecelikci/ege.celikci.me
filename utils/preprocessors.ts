import media from "./preprocessors/media.ts";
import events from "./preprocessors/events.ts";
import feeds from "./preprocessors/feeds.ts";
import stats from "./preprocessors/stats.ts";

/**
 * Modular preprocessor registration.
 * Decouples logic for media, events, feeds, and statistics.
 */
export default function registerPreprocessors(site: Lume.Site) {
  site.use(media());
  site.use(events());
  site.use(feeds());
  site.use(stats());
}
