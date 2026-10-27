import media from "./media.ts";
import events from "./events.ts";
import stats from "./stats.ts";
import edited from "./edited.ts";
import incoming from "./incoming.ts";

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
