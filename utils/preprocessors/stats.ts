/**
 * utils/preprocessors/stats.ts
 * Processes Webmention statistics for pages.
 */

import { site as settings } from "../../_config/metadata.ts";
import { filters } from "../filters.ts";
import { computeWebmentionStats } from "../webmention-stats.ts";

export default function () {
  return (site: Lume.Site) => {
    site.preprocess([".md"], (pages) => {
      for (const page of pages) {
        const pageUrl = page.data.url;
        if (!pageUrl) continue;

        // Webmention stats logic
        const stats = computeWebmentionStats(
          page.data.webmentions,
          settings.url,
          pageUrl,
          filters.isOwnWebmention,
        );

        page.data.stats = stats;
      }
    });
  };
}
