/**
 * Processes Webmention statistics for pages.
 */

import {
  author as authorMeta,
  site as settings,
} from "../../_config/metadata.ts";
import { isOwnWebmention, ownUrls } from "../../lib/webmentions.ts";
import { computeWebmentionStats } from "../../lib/webmention-stats.ts";

/** One list for the whole build: the URLs that count as this site's own. */
const OWN_URLS = ownUrls(settings.url, authorMeta);

export default function () {
  return (site: Lume.Site) => {
    site.preprocess([".md"], (pages) => {
      for (const page of pages) {
        const pageUrl = page.data.url;
        if (!pageUrl) continue;

        /** Webmention stats logic */
        const stats = computeWebmentionStats(
          page.data.webmentions,
          settings.url,
          pageUrl,
          (mention) => isOwnWebmention(mention, OWN_URLS),
        );

        page.data.stats = stats;
      }
    });
  };
}
