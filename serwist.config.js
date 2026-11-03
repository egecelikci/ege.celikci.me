/**
 * What the service worker precaches: exactly the offline page and what it loads, so it renders with no network.
 *
 * Everything else (feature chunks like the map or the lightbox, extra font weights, images) is cached at runtime when a page that needs it is visited. Precaching it all used to cost every first-time visitor about 860 kB of background downloads for files most of them never use.
 */
export default {
  globDirectory: "dist/",
  globPatterns: [
    "offline/index.html",
    "manifest.json",
    "assets/styles/site.css",
    "assets/styles/vendor/photoswipe.css",
    "assets/scripts/main.js",
    // Shared chunks `main.js` imports statically, plus the two it loads on every page.
    "assets/scripts/chunks/chunk-*.js",
    "assets/scripts/chunks/register-serviceworker-*.js",
    "assets/scripts/chunks/touch-*.js",
    "assets/icons/icons.sprite.svg",
    // The weights the offline page preloads.
    "assets/fonts/dm-sans-normal-100-1000-latin.woff2",
    "assets/fonts/dm-sans-normal-100-1000-latin-ext.woff2",
    "assets/fonts/dm-mono-normal-400-latin.woff2",
    "assets/images/favicon/*",
  ],
  swSrc: "sw.ts",
  swDest: "dist/sw.js",
  injectionPoint: "self.__SW_MANIFEST",
};
