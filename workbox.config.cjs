module.exports = {
  globDirectory: "dist/",
  globPatterns: [
    "**/*.{html,css,js,mjs,json,xml,ico,svg,woff2,woff,png,jpg,jpeg,webp,avif}",
  ],
  swDest: "dist/sw.js",
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst", // Prefer fresh content, fallback to offline
      options: {
        cacheName: "pages",
        plugins: [
          {
            handlerDidError: async () => {
              return await caches.match("/offline/index.html");
            },
          },
        ],
      },
    },
    {
      urlPattern: ({ request }) =>
        request.destination === "style" ||
        request.destination === "script" ||
        request.destination === "worker",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "assets",
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        },
      },
    },
  ],
};
