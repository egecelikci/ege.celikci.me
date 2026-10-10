import media from "./preprocessors/media.ts";
import events from "./preprocessors/events.ts";
import stats from "./preprocessors/stats.ts";
import edited from "./preprocessors/edited.ts";
import incoming from "./preprocessors/incoming.ts";

/**
 * Modular preprocessor registration.
 * Decouples logic for media, events, statistics, edit history, and the doc graph.
 */
export default function registerPreprocessors(site: Lume.Site) {
  site.use(media());
  site.use(events());
  site.use(stats());
  site.use(edited());
  site.use(incoming());
}
