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

  site.preprocess([".html"], (pages) => {
    for (const page of pages) {
      const content = String(page.content ?? "");
      if (content.includes("lightbox-trigger") || content.includes("pswp")) {
        const extra = (page.data.extraStyles as string[] | undefined) ?? [];
        if (!extra.includes("/assets/styles/photoswipe.css")) {
          page.data.extraStyles = [...extra, "/assets/styles/photoswipe.css"];
        }
      }
    }
  });
}
