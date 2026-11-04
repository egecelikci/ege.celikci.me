/**
 * The site's service worker, built with Serwist.
 *
 * `_config.ts` bundles it after every build and injects the precache list from `serwist.config.js`.
 */

import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";
import type {
  PrecacheEntry,
  SerwistGlobalConfig,
  SerwistPlugin,
} from "serwist";
import { COLLAGE_API } from "./lib/collage-api.ts";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

/**
 * Cache a response only when it has the content type the route expects.
 * Netlify's edge once answered cover URLs with stats JSON; a cache-first route would have kept serving that for a year.
 */
const onlyContentTypes = (...prefixes: string[]): SerwistPlugin => ({
  cacheWillUpdate: async ({ response }) => {
    const type = response.headers.get("Content-Type") ?? "";
    return response.ok && prefixes.some((p) => type.startsWith(p))
      ? response
      : null;
  },
});

/** Runtime caches renamed to drop entries stored before the content type check. */
const RETIRED_CACHES = ["collage-covers-v1", "collage-api-v1"];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    // Pages request assets as `site.css?v=<build>`; the precache stores `site.css` with its own revision, so without ignoring `v` no precached asset ever matched and offline styling depended on the HTTP cache.
    ignoreURLParametersMatching: [/^v$/, /^utm_/, /^fbclid$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
          {
            handlerDidError: async (): Promise<Response | undefined> => {
              return await serwist.matchPrecache("/offline/index.html");
            },
          },
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith(`${COLLAGE_API}/cover/`),
      handler: new CacheFirst({
        cacheName: "collage-covers-v2",
        plugins: [
          onlyContentTypes("image/"),
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith(`${COLLAGE_API}/`),
      handler: new NetworkFirst({
        cacheName: "collage-api-v2",
        networkTimeoutSeconds: 5,
        plugins: [
          onlyContentTypes("application/json", "font/"),
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60,
          }),
        ],
      }),
    },
    {
      // Index chunks, fragments, and filters have content-hashed names, so a cached copy is never stale.
      matcher: ({ url }) =>
        /^\/pagefind\/(fragment|index|filter)\//.test(url.pathname) ||
        url.pathname.endsWith(".pf_meta"),
      handler: new CacheFirst({
        cacheName: "pagefind-chunks",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      // The loader, wasm, worker, and entry file keep their names across builds, so prefer the network.
      matcher: ({ url }) => url.pathname.startsWith("/pagefind/"),
      handler: new NetworkFirst({
        cacheName: "pagefind",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 20 })],
      }),
    },
    {
      // Workers are started by a fixed URL (`new Worker("/assets/scripts/collage-worker.js")`), so a cached copy could outlive a deploy and import chunks that no longer exist.
      matcher: ({ request }) => request.destination === "worker",
      handler: new NetworkFirst({
        cacheName: "workers",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 5 })],
      }),
    },
    {
      // Every script and style URL in the pages is versioned (a hashed chunk name or `?v=<build>`), so a cached copy can never be stale and asking the network first only adds a round trip.
      matcher: ({ request }) =>
        request.destination === "style" || request.destination === "script",
      handler: new CacheFirst({
        cacheName: "assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "font",
      handler: new CacheFirst({
        cacheName: "fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();

// Idempotent, so running it on every worker start is cheaper than wiring an activate handler.
void Promise.all(RETIRED_CACHES.map((name) => caches.delete(name)));
