/**
 * sw.ts
 * Service worker built with Serwist. Bundled and manifest-injected by
 * `@serwist/cli build` in the `afterBuild` hook.
 */

import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
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
          {
            handlerDidError: async () => {
              return await caches.match("/offline/index.html");
            },
          },
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        url.pathname === "/api/collage-proxy" &&
        url.searchParams.get("source") === "cover",
      handler: new CacheFirst({
        cacheName: "collage-covers-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) =>
        url.pathname === "/api/collage-proxy" &&
        url.searchParams.get("source") !== "cover",
      handler: new NetworkFirst({
        cacheName: "collage-api-v1",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 20,
            maxAgeSeconds: 60 * 60,
          }),
        ],
      }),
    },
    {
      matcher: ({ request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker",
      handler: new NetworkFirst({
        cacheName: "assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60,
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
