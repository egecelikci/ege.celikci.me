import type { Site } from "lume/core.ts";
import images from "./preprocessors/images.ts";
import events from "./preprocessors/events.ts";
import feeds from "./preprocessors/feeds.ts";
import stats from "./preprocessors/stats.ts";

/**
 * Modular preprocessor registration.
 * Decouples logic for images, events, feeds, and statistics.
 */
export default function registerPreprocessors(site: Site) {
  site.use(images());
  site.use(events());
  site.use(feeds());
  site.use(stats());
}
