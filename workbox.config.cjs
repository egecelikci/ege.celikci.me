module.exports = {
  globDirectory: "dist/",
  globPatterns: ["**/*.{html,css,js,mjs,json,xml,ico,svg,woff2}"],
  swDest: "dist/sw.js",
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkOnly",
      options: {
        precacheFallback: {
          fallbackURL: "/offline/index.html",
        },
      },
    },
  ],
};
