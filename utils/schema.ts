/**
 * schema.org classification for the page wrapper, used as microdata on `<body>`.
 *
 * Only the home page is a `WebSite` — that is where Google's site-name feature reads it — listings are `CollectionPage`s, everything else is a `WebPage`.
 * Kept pure so `utils/schema.test.ts` covers the classification.
 */

/**
 * Routes that list other pages. They carry no `type`, so they are recognised by URL, the same way the feeds preprocessor recognises the pages it adds feeds to.
 */
const LISTING_ROUTES = [
  "/notes/",
  "/events/",
  "/events/archive/",
  "/games/",
  "/music/",
  "/tags/",
  "/feeds/",
];

export function pageType(page: { url?: string; type?: string }): string {
  if (page.url === "/") return "https://schema.org/WebSite";
  if (
    page.type === "tag" || page.type === "index" ||
    LISTING_ROUTES.includes(page.url ?? "")
  ) {
    return "https://schema.org/CollectionPage";
  }
  return "https://schema.org/WebPage";
}
